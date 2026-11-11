//! YouTube/InnerTube fetch proxy.
//!
//! Ports `apps/extension/src/background/proxy.ts`: call YouTube endpoints with
//! the Origin/Referer/X-Origin headers a browser page cannot set. A desktop
//! app has no CORS wall, so the extension's DNR header rules become plain
//! request headers here.
//!
//! Two identities (account safety, see docs/desktop.md):
//! - `signed: true`  -> account features (home, library, likes, playlists,
//!   history). Cookies + SAPISIDHASH are attached here in Rust, rate-limited.
//! - `signed: false` -> everything else, notably youtubei.js stream
//!   resolution. Never carries the user's cookies.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

const MUSIC_ORIGIN: &str = "https://music.youtube.com";
const WEB_ORIGIN: &str = "https://www.youtube.com";
const MUSIC_CLIENT_NAME: &str = "67";
const MUSIC_CLIENT_VERSION: &str = "1.20251006.03.00";
const WEB_CLIENT_NAME: &str = "1";
const WEB_CLIENT_VERSION: &str = "2.20251006.00.00";
const FALLBACK_UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyFetchPayload {
    pub url: String,
    pub method: Option<String>,
    pub headers: Option<HashMap<String, String>>,
    /// String or JSON object (the web app sends both).
    #[serde(default)]
    pub body: Option<serde_json::Value>,
    /// Attach the signed-in YouTube session (account features only).
    #[serde(default)]
    pub signed: bool,
    pub auth_user: Option<String>,
    pub page_id: Option<String>,
    /// The webview's own User-Agent, so every request looks like one client.
    pub user_agent: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ProxyFetchResponse {
    pub status: u16,
    #[serde(rename = "statusText")]
    pub status_text: String,
    pub headers: HashMap<String, String>,
    /// Parsed JSON when the body is JSON, otherwise the raw text.
    pub data: serde_json::Value,
}

fn host_allowed(host: &str) -> bool {
    host.ends_with("youtube.com")
        || host.ends_with("googlevideo.com")
        || host.ends_with("youtubei.googleapis.com")
        || host.ends_with("ytimg.com")
        || host.ends_with("ggpht.com")
        || host.ends_with("googleusercontent.com")
        || host.ends_with("google.com")
}

/// Cookies are only ever sent to these exact hosts (same list as the extension).
fn signed_host_allowed(host: &str) -> bool {
    matches!(host, "music.youtube.com" | "www.youtube.com" | "youtube.com")
}

/// Headers we always control ourselves; never taken from the caller.
const CONTROLLED_HEADERS: [&str; 11] = [
    "origin",
    "referer",
    "x-origin",
    "cookie",
    "host",
    "content-length",
    "authorization",
    "x-goog-authuser",
    "x-goog-pageid",
    "user-agent",
    "accept-encoding",
];

pub fn http_client() -> &'static reqwest::blocking::Client {
    static CLIENT: OnceLock<reqwest::blocking::Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        reqwest::blocking::Client::builder()
            .pool_idle_timeout(Duration::from_secs(90))
            .build()
            .expect("http client")
    })
}

// ---- Signed-request rate limiter (token bucket + backoff) ------------------

struct Limiter {
    tokens: f64,
    last: Instant,
    blocked_until: Option<Instant>,
    backoff: Duration,
}

const BUCKET_CAPACITY: f64 = 30.0;
const REFILL_PER_SEC: f64 = 1.0; // ~60 signed calls/minute sustained
const MAX_WAIT: Duration = Duration::from_secs(8);
const MIN_BACKOFF: Duration = Duration::from_secs(30);
const MAX_BACKOFF: Duration = Duration::from_secs(600);

fn limiter() -> &'static Mutex<Limiter> {
    static L: OnceLock<Mutex<Limiter>> = OnceLock::new();
    L.get_or_init(|| {
        Mutex::new(Limiter {
            tokens: BUCKET_CAPACITY,
            last: Instant::now(),
            blocked_until: None,
            backoff: MIN_BACKOFF,
        })
    })
}

/// Waits for a token (bounded). Err when backing off or saturated.
fn acquire_signed_slot() -> Result<(), String> {
    let deadline = Instant::now() + MAX_WAIT;
    loop {
        {
            let mut l = limiter().lock().map_err(|_| "limiter poisoned")?;
            let now = Instant::now();
            if let Some(until) = l.blocked_until {
                if now < until {
                    return Err(format!(
                        "YouTube asked us to slow down; signed requests paused for {}s",
                        (until - now).as_secs()
                    ));
                }
                l.blocked_until = None;
            }
            let elapsed = now.duration_since(l.last).as_secs_f64();
            l.tokens = (l.tokens + elapsed * REFILL_PER_SEC).min(BUCKET_CAPACITY);
            l.last = now;
            if l.tokens >= 1.0 {
                l.tokens -= 1.0;
                return Ok(());
            }
        }
        if Instant::now() >= deadline {
            return Err("signed request rate limit reached".into());
        }
        std::thread::sleep(Duration::from_millis(250));
    }
}

fn note_signed_status(status: u16) {
    if let Ok(mut l) = limiter().lock() {
        if status == 429 {
            l.blocked_until = Some(Instant::now() + l.backoff);
            l.backoff = (l.backoff * 2).min(MAX_BACKOFF);
        } else if status < 400 {
            l.backoff = MIN_BACKOFF;
        }
    }
}

// ---- Command ---------------------------------------------------------------

#[tauri::command]
pub async fn proxy_fetch(payload: ProxyFetchPayload) -> Result<ProxyFetchResponse, String> {
    tauri::async_runtime::spawn_blocking(move || do_fetch(payload))
        .await
        .map_err(|e| e.to_string())?
}

fn do_fetch(payload: ProxyFetchPayload) -> Result<ProxyFetchResponse, String> {
    let mut parsed = url::Url::parse(&payload.url).map_err(|e| e.to_string())?;
    if parsed.scheme() != "https" {
        return Err("proxy_fetch: https only".into());
    }
    let host = parsed.host_str().unwrap_or("").to_string();
    if !host_allowed(&host) {
        return Err(format!("proxy_fetch: host not allowed: {host}"));
    }

    let is_public_player_js = parsed.path().starts_with("/s/player/");
    let signed = payload.signed && signed_host_allowed(&host) && !is_public_player_js;

    let is_desktop_yt = host != "music.youtube.com" && host.ends_with("youtube.com");
    let target_origin = if is_desktop_yt { WEB_ORIGIN } else { MUSIC_ORIGIN };
    let (client_name, client_version) = if is_desktop_yt {
        (WEB_CLIENT_NAME, WEB_CLIENT_VERSION)
    } else {
        (MUSIC_CLIENT_NAME, MUSIC_CLIENT_VERSION)
    };

    let auth_user = if signed {
        payload
            .auth_user
            .clone()
            .filter(|s| !s.is_empty() && s.chars().all(|c| c.is_ascii_digit()))
            .unwrap_or_else(|| "0".to_string())
    } else {
        "0".to_string()
    };

    let is_innertube = parsed.path().starts_with("/youtubei/");
    if is_innertube || signed {
        let kept: Vec<(String, String)> = parsed
            .query_pairs()
            .filter(|(k, _)| k != "authuser")
            .map(|(k, v)| (k.into_owned(), v.into_owned()))
            .collect();
        parsed
            .query_pairs_mut()
            .clear()
            .extend_pairs(kept)
            .append_pair("authuser", &auth_user);
    }

    // Resolve the session before spending a rate-limit token.
    let session = if signed {
        crate::auth::session_for(&format!("https://{host}/"))
    } else {
        None
    };
    if session.is_some() {
        acquire_signed_slot()?;
    }

    let method = payload
        .method
        .clone()
        .unwrap_or_else(|| "GET".to_string())
        .to_uppercase();
    let mut req = http_client().request(
        method.parse().map_err(|_| "invalid method".to_string())?,
        parsed.as_str(),
    );

    let mut caller_sent_content_type = false;
    if let Some(headers) = &payload.headers {
        for (k, v) in headers {
            let lower = k.to_ascii_lowercase();
            if CONTROLLED_HEADERS.contains(&lower.as_str()) {
                continue;
            }
            if lower == "content-type" {
                caller_sent_content_type = true;
            }
            req = req.header(k, v);
        }
    }

    let ua = payload
        .user_agent
        .as_deref()
        .filter(|s| !s.is_empty())
        .unwrap_or(FALLBACK_UA);
    req = req.header("User-Agent", ua);

    if is_innertube {
        req = req
            .header("Origin", target_origin)
            .header("Referer", format!("{target_origin}/"))
            .header("X-Origin", target_origin)
            .header("X-YouTube-Client-Name", client_name)
            .header("X-YouTube-Client-Version", client_version)
            .header("X-Goog-AuthUser", auth_user.as_str());
    }

    if let Some((cookie_header, sapisid)) = &session {
        req = req
            .header("Cookie", cookie_header.as_str())
            .header("Authorization", crate::auth::sapisid_hash(sapisid, target_origin))
            .header("X-Goog-AuthUser", auth_user.as_str());
        if let Some(page_id) = payload.page_id.as_deref().filter(|p| !p.is_empty()) {
            req = req.header("X-Goog-PageId", page_id);
        }
    }

    if let Some(body) = payload.body {
        let text = match body {
            serde_json::Value::Null => None,
            serde_json::Value::String(s) => Some(s),
            other => Some(other.to_string()),
        };
        if let Some(text) = text {
            if !caller_sent_content_type {
                req = req.header("Content-Type", "application/json");
            }
            req = req.body(text);
        }
    }

    let res = req.send().map_err(|e| e.to_string())?;
    let status = res.status();
    if session.is_some() {
        note_signed_status(status.as_u16());
    }
    let mut headers = HashMap::new();
    for (k, v) in res.headers() {
        if let Ok(val) = v.to_str() {
            headers.insert(k.as_str().to_string(), val.to_string());
        }
    }
    let text = res.text().map_err(|e| e.to_string())?;
    let data = serde_json::from_str(&text).unwrap_or(serde_json::Value::String(text));

    Ok(ProxyFetchResponse {
        status: status.as_u16(),
        status_text: status.canonical_reason().unwrap_or("").to_string(),
        headers,
        data,
    })
}
