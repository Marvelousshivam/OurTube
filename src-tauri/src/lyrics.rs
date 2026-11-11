//! Lyrics HTTP proxy for the desktop app.
//!
//! Ports `apps/extension/src/background/lyricsProxy.ts`: non-CORS GETs to the
//! allowlisted lyric providers (KuGou, Musixmatch, Genius, Apple Music,
//! PaxSenix, BetterLyrics/Boidu, LyricsPlus), with bounded manual redirects
//! and Musixmatch's required anonymous A/B token cookie.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::OnceLock;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const ALLOWED_LYRIC_HOSTS: [&str; 15] = [
    "mobileservice.kugou.com",
    "lyrics.kugou.com",
    "apic.musixmatch.com",
    "www.musixmatch.com",
    "genius.com",
    "music.apple.com",
    "amp-api.music.apple.com",
    "api.paxsenix.org",
    "lyrics.paxsenix.org",
    "lyrics-api.boidu.dev",
    "unison.boidu.dev",
    "lyricsplus.prjktla.my.id",
    "lyricsplus.binimum.org",
    "lyrics-api.binimum.org",
    "lrclib.net",
];

const CALLER_ALLOWED_HEADERS: [&str; 3] = ["authorization", "accept", "accept-language"];
const MAX_REDIRECTS: usize = 5;
const USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0";

#[derive(Debug, Deserialize)]
pub struct LyricsFetchRequest {
    pub url: String,
    pub headers: Option<HashMap<String, String>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LyricsFetchResponse {
    pub status: u16,
    pub headers: HashMap<String, String>,
    pub body: String,
    pub body_encoding: String,
}

fn is_allowed_lyric_url(raw: &str) -> Option<url::Url> {
    let parsed = url::Url::parse(raw).ok()?;
    if parsed.scheme() != "https" {
        return None;
    }
    let host = parsed.host_str()?;
    if ALLOWED_LYRIC_HOSTS.contains(&host) {
        Some(parsed)
    } else {
        None
    }
}

fn mxm_token_guid() -> &'static str {
    static GUID: OnceLock<String> = OnceLock::new();
    GUID.get_or_init(|| {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0x1234_5678_9abc_def0);
        let pid = std::process::id() as u128;
        let v = nanos ^ (pid << 64);
        format!(
            "{:08x}-{:04x}-4{:03x}-{:04x}-{:012x}",
            (v >> 96) as u32,
            ((v >> 80) & 0xffff) as u16,
            ((v >> 64) & 0x0fff) as u16,
            (((v >> 48) & 0x3fff) | 0x8000) as u16,
            (v & 0xffff_ffff_ffff) as u64
        )
    })
}

fn no_redirect_client() -> &'static reqwest::blocking::Client {
    static CLIENT: OnceLock<reqwest::blocking::Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        reqwest::blocking::Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .timeout(Duration::from_secs(14))
            .pool_idle_timeout(Duration::from_secs(60))
            .build()
            .expect("lyrics http client")
    })
}

#[tauri::command]
pub async fn lyrics_fetch(payload: LyricsFetchRequest) -> Result<LyricsFetchResponse, String> {
    tauri::async_runtime::spawn_blocking(move || do_lyrics_fetch(payload))
        .await
        .map_err(|e| e.to_string())?
}

fn do_lyrics_fetch(payload: LyricsFetchRequest) -> Result<LyricsFetchResponse, String> {
    let mut current = is_allowed_lyric_url(&payload.url)
        .ok_or_else(|| format!("Disallowed lyric host: {}", payload.url))?;

    let mut sanitized_headers: HashMap<String, String> = HashMap::new();
    if let Some(hdrs) = payload.headers {
        for (k, v) in hdrs {
            let lower = k.trim().to_ascii_lowercase();
            if CALLER_ALLOWED_HEADERS.contains(&lower.as_str()) {
                sanitized_headers.insert(lower, v);
            }
        }
    }

    let client = no_redirect_client();

    for _hop in 0..=MAX_REDIRECTS {
        let mut req = client
            .get(current.as_str())
            .header("User-Agent", USER_AGENT);

        for (k, v) in &sanitized_headers {
            req = req.header(k.as_str(), v.as_str());
        }

        if current.host_str() == Some("apic.musixmatch.com")
            && current.path().starts_with("/ws/1.1/token.get")
        {
            req = req.header(
                "Cookie",
                format!("x-mxm-token-guid={}; mxm_bab=AB", mxm_token_guid()),
            );
        }

        let res = req.send().map_err(|e| e.to_string())?;
        let status = res.status().as_u16();

        if (300..400).contains(&status) {
            let loc = res
                .headers()
                .get("location")
                .and_then(|v| v.to_str().ok())
                .ok_or_else(|| "Redirect without Location header".to_string())?;
            let joined = current.join(loc).map_err(|e| e.to_string())?;
            let next = is_allowed_lyric_url(joined.as_str())
                .ok_or_else(|| format!("Disallowed redirect target: {loc}"))?;
            if next.host_str() != current.host_str() {
                sanitized_headers.remove("authorization");
            }
            current = next;
            continue;
        }

        let mut response_headers = HashMap::new();
        for (k, v) in res.headers() {
            if let Ok(val) = v.to_str() {
                response_headers.insert(k.as_str().to_ascii_lowercase(), val.to_string());
            }
        }
        let body = res.text().map_err(|e| e.to_string())?;

        return Ok(LyricsFetchResponse {
            status,
            headers: response_headers,
            body,
            body_encoding: "utf8".to_string(),
        });
    }

    Err("Too many redirects".to_string())
}
