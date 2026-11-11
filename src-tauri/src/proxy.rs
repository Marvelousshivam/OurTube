//! Generic YouTube/InnerTube fetch proxy.
//!
//! Ports the job the browser extension's background worker did in
//! `apps/extension/src/background/proxy.ts`: call YouTube endpoints with the
//! Origin/Referer/X-Origin headers a browser page is not allowed to set.
//! A desktop app has no CORS wall, so the DNR header-rewrite rules are
//! replaced by simply setting the headers here.
//!
//! Auth note (phase 1): requests go out anonymously (authuser=0, no
//! SAPISIDHASH). Signed-in session support ports next; see docs/desktop.md.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

const MUSIC_ORIGIN: &str = "https://music.youtube.com";
const WEB_ORIGIN: &str = "https://www.youtube.com";
const MUSIC_CLIENT_NAME: &str = "67";
const MUSIC_CLIENT_VERSION: &str = "1.20251006.03.00";
const WEB_CLIENT_NAME: &str = "1";
const WEB_CLIENT_VERSION: &str = "2.20251006.00.00";

#[derive(Debug, Deserialize)]
pub struct ProxyFetchPayload {
    pub url: String,
    pub method: Option<String>,
    pub headers: Option<HashMap<String, String>>,
    #[serde(default)]
    pub body: Option<String>,
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

/// Headers we always control ourselves; never taken from the caller.
const CONTROLLED_HEADERS: [&str; 9] = [
    "origin",
    "referer",
    "x-origin",
    "cookie",
    "host",
    "content-length",
    "authorization",
    "x-goog-authuser",
    "x-goog-pageid",
];

#[tauri::command]
pub async fn proxy_fetch(payload: ProxyFetchPayload) -> Result<ProxyFetchResponse, String> {
    tauri::async_runtime::spawn_blocking(move || do_fetch(payload))
        .await
        .map_err(|e| e.to_string())?
}

fn do_fetch(payload: ProxyFetchPayload) -> Result<ProxyFetchResponse, String> {
    let mut parsed = url::Url::parse(&payload.url).map_err(|e| e.to_string())?;
    let host = parsed.host_str().unwrap_or("").to_string();
    if !host_allowed(&host) {
        return Err(format!("proxy_fetch: host not allowed: {host}"));
    }

    let is_desktop_yt = !payload.url.contains("music.youtube.com")
        && (payload.url.contains("www.youtube.com") || payload.url.contains("youtube.com/youtubei"));
    let target_origin = if is_desktop_yt { WEB_ORIGIN } else { MUSIC_ORIGIN };
    let (client_name, client_version) = if is_desktop_yt {
        (WEB_CLIENT_NAME, WEB_CLIENT_VERSION)
    } else {
        (MUSIC_CLIENT_NAME, MUSIC_CLIENT_VERSION)
    };

    let is_innertube = payload.url.contains("/youtubei/");
    if is_innertube {
        // Anonymous session: always account index 0 (matches the extension's unsigned path).
        parsed.query_pairs_mut().set_pair("authuser", "0");
    }

    let client = reqwest::blocking::Client::builder()
        .build()
        .map_err(|e| e.to_string())?;

    let method = payload
        .method
        .clone()
        .unwrap_or_else(|| "GET".to_string())
        .to_uppercase();
    let mut req = client.request(
        method.parse().map_err(|_| "invalid method".to_string())?,
        parsed.as_str(),
    );

    if let Some(headers) = &payload.headers {
        for (k, v) in headers {
            if CONTROLLED_HEADERS.contains(&k.to_ascii_lowercase().as_str()) {
                continue;
            }
            req = req.header(k, v);
        }
    }

    if is_innertube {
        req = req
            .header("Origin", target_origin)
            .header("Referer", format!("{target_origin}/"))
            .header("X-Origin", target_origin)
            .header("X-YouTube-Client-Name", client_name)
            .header("X-YouTube-Client-Version", client_version)
            .header("X-Goog-AuthUser", "0");
    }

    if let Some(body) = payload.body {
        req = req.header("Content-Type", "application/json").body(body);
    }

    let res = req.send().map_err(|e| e.to_string())?;
    let status = res.status();
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
