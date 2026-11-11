//! Lossless extension / addon proxy.
//!
//! Provides non-CORS network requests to user-configured lossless music
//! extensions (such as ReZenOnance or any Universal Addon Manifest protocol provider).
//! Attaches the persistent device lease token (`X-Zombie-Tracker` and `__rz_tracker` cookie)
//! so personal gateway instances maintain a single device lease.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Duration;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddonFetchPayload {
    pub url: String,
    pub zombie_tracker: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AddonFetchResponse {
    pub status: u16,
    pub ok: bool,
    pub data: serde_json::Value,
    pub headers: HashMap<String, String>,
}

#[tauri::command]
pub async fn addon_fetch(payload: AddonFetchPayload) -> Result<AddonFetchResponse, String> {
    tauri::async_runtime::spawn_blocking(move || do_addon_fetch(payload))
        .await
        .map_err(|e| e.to_string())?
}

fn do_addon_fetch(payload: AddonFetchPayload) -> Result<AddonFetchResponse, String> {
    let parsed = url::Url::parse(&payload.url).map_err(|e| e.to_string())?;
    if parsed.scheme() != "https" && parsed.scheme() != "http" {
        return Err("addon_fetch: http/https only".into());
    }

    let client = crate::proxy::http_client();
    let mut req = client
        .get(parsed.as_str())
        .header("Accept", "application/json")
        .header("User-Agent", "BitChord-Addon/1.0 OurTube-Desktop/1.0")
        .timeout(Duration::from_secs(8));

    if let Some(tracker) = payload.zombie_tracker.as_deref().filter(|s| !s.is_empty()) {
        req = req
            .header("X-Zombie-Tracker", tracker)
            .header("Cookie", format!("__rz_tracker={tracker}"));
    }

    let res = req.send().map_err(|e| e.to_string())?;
    let status = res.status().as_u16();
    let ok = (200..300).contains(&status);

    let mut headers = HashMap::new();
    for (k, v) in res.headers() {
        if let Ok(val) = v.to_str() {
            headers.insert(k.as_str().to_ascii_lowercase(), val.to_string());
        }
    }

    let text = res.text().map_err(|e| e.to_string())?;
    let data = serde_json::from_str(&text).unwrap_or(serde_json::Value::String(text));

    Ok(AddonFetchResponse {
        status,
        ok,
        data,
        headers,
    })
}
