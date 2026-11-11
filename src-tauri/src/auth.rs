//! YouTube sign-in for the desktop app.
//!
//! Replaces the extension's cookie access (`apps/extension/src/background/auth.ts`).
//! The user signs in to Google in a dedicated app window; that window shares
//! the app's WebView2 cookie store, so the session persists across restarts.
//!
//! Cookies never leave Rust: the proxy reads them here and attaches
//! `Cookie` + `Authorization: SAPISIDHASH ...` to signed YouTube requests.
//! The webview JS only ever learns *whether* a session exists.

use sha1::{Digest, Sha1};
use std::sync::OnceLock;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager, Url, WebviewUrl, WebviewWindowBuilder, WindowEvent};

static APP: OnceLock<AppHandle> = OnceLock::new();

const SIGNING_COOKIES: [&str; 3] = ["SAPISID", "__Secure-3PAPISID", "__Secure-1PAPISID"];
const FALLBACK_COOKIE_URLS: [&str; 3] = [
    "https://music.youtube.com/",
    "https://www.youtube.com/",
    "https://youtube.com/",
];
const LOGIN_LABEL: &str = "login";
const LOGOUT_LABEL: &str = "logout";
const LOGIN_URL: &str =
    "https://accounts.google.com/ServiceLogin?service=youtube&continue=https%3A%2F%2Fmusic.youtube.com%2F";
const ADD_SESSION_URL: &str =
    "https://accounts.google.com/AddSession?service=youtube&continue=https%3A%2F%2Fmusic.youtube.com%2F";
const LOGOUT_URL: &str =
    "https://accounts.google.com/Logout?continue=https%3A%2F%2Fmusic.youtube.com%2F";

pub fn init(app: &AppHandle) {
    let _ = APP.set(app.clone());
}

fn read_cookies_for(window: &tauri::WebviewWindow, raw_url: &str) -> Option<(String, String)> {
    let parsed = Url::parse(raw_url).ok()?;
    let cookies = window.cookies_for_url(parsed).ok()?;
    if cookies.is_empty() {
        return None;
    }
    let sapisid = SIGNING_COOKIES.iter().find_map(|name| {
        cookies
            .iter()
            .find(|c| c.name() == *name && !c.value().is_empty())
            .map(|c| c.value().to_string())
    })?;
    let header = cookies
        .iter()
        .map(|c| format!("{}={}", c.name(), c.value()))
        .collect::<Vec<_>>()
        .join("; ");
    Some((header, sapisid))
}

/// Cookie header + SAPISID for a YouTube URL, read from the shared WebView2 store.
///
/// Must not run on the main thread on Windows (WebView2 cookie access
/// deadlocks there); callers run inside `spawn_blocking` / worker threads.
pub fn session_for(url: &str) -> Option<(String, String)> {
    let app = APP.get()?;
    let window = app.get_webview_window("main")?;
    if let Some(found) = read_cookies_for(&window, url) {
        return Some(found);
    }
    for fallback in FALLBACK_COOKIE_URLS {
        if fallback != url {
            if let Some(found) = read_cookies_for(&window, fallback) {
                return Some(found);
            }
        }
    }
    None
}

/// `SAPISIDHASH {ts}_{sha1("{ts} {sapisid} {origin}")}` - same as the extension.
pub fn sapisid_hash(sapisid: &str, origin: &str) -> String {
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let mut hasher = Sha1::new();
    hasher.update(format!("{ts} {sapisid} {origin}").as_bytes());
    format!("SAPISIDHASH {ts}_{}", hex::encode(hasher.finalize()))
}

fn has_session() -> bool {
    session_for("https://music.youtube.com/").is_some()
}

#[tauri::command]
pub async fn auth_signed_in() -> bool {
    tauri::async_runtime::spawn_blocking(has_session)
        .await
        .unwrap_or(false)
}

/// Opens the Google sign-in window. When the user lands back on
/// music.youtube.com with a session (or closes the window), emits `auth-changed`.
#[tauri::command]
pub async fn auth_open_login(app: AppHandle, add_session: bool) -> Result<(), String> {
    if let Some(existing) = app.get_webview_window(LOGIN_LABEL) {
        let _ = existing.set_focus();
        return Ok(());
    }
    let start = if add_session { ADD_SESSION_URL } else { LOGIN_URL };
    let url = Url::parse(start).map_err(|e| e.to_string())?;

    let win = WebviewWindowBuilder::new(&app, LOGIN_LABEL, WebviewUrl::External(url))
        .title("Sign in to YouTube Music - OurTube")
        .inner_size(500.0, 740.0)
        .center()
        .on_page_load(|window, payload| {
            if !matches!(payload.event(), tauri::webview::PageLoadEvent::Finished) {
                return;
            }
            let host = payload.url().host_str().unwrap_or("");
            if host != "music.youtube.com" && host != "www.youtube.com" {
                return;
            }
            // Cookie access must happen off the event-handler thread on Windows.
            std::thread::spawn(move || {
                if has_session() {
                    let _ = window.app_handle().emit("auth-changed", true);
                    let _ = window.close();
                }
            });
        })
        .build()
        .map_err(|e| e.to_string())?;

    let app_for_close = app.clone();
    win.on_window_event(move |event| {
        if matches!(event, WindowEvent::Destroyed) {
            let app_handle = app_for_close.clone();
            std::thread::spawn(move || {
                let signed_in = has_session();
                let _ = app_handle.emit("auth-changed", signed_in);
            });
        }
    });

    Ok(())
}

/// Signs out of Google in the shared cookie store via Google's own logout
/// page in a hidden window (keeps the app's own localStorage/settings intact).
#[tauri::command]
pub async fn auth_sign_out(app: AppHandle) -> Result<(), String> {
    if let Some(existing) = app.get_webview_window(LOGOUT_LABEL) {
        let _ = existing.close();
    }
    let url = Url::parse(LOGOUT_URL).map_err(|e| e.to_string())?;
    WebviewWindowBuilder::new(&app, LOGOUT_LABEL, WebviewUrl::External(url))
        .visible(false)
        .on_page_load(|window, payload| {
            if !matches!(payload.event(), tauri::webview::PageLoadEvent::Finished) {
                return;
            }
            let host = payload.url().host_str().unwrap_or("");
            if host == "music.youtube.com" || host == "www.youtube.com" || host == "accounts.google.com" {
                std::thread::spawn(move || {
                    if !has_session() {
                        let _ = window.app_handle().emit("auth-changed", false);
                        let _ = window.close();
                    }
                });
            }
        })
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}
