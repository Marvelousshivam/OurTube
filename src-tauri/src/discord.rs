//! Native Discord Rich Presence via Discord's local IPC named pipe.
//!
//! Unlike the browser extension (which had to read the user's Discord token
//! and maintain a Gateway WebSocket), a desktop app can talk directly to the
//! local Discord client over `\\.\pipe\discord-ipc-0..9` using OurTube's
//! registered application ID (`1543679166967193620`). No Discord login or user
//! token is required.

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::fs::{File, OpenOptions};
use std::io::{Read, Write};
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

const APPLICATION_ID: &str = "1543679166967193620";
const PROJECT_URL: &str = "https://github.com/Marvelousshivam/OurTube";
const DEFAULT_BUTTON_1: &str = "Listen on YouTube Music";
const DEFAULT_BUTTON_2: &str = "Visit OurTube";
const APP_NAME: &str = "OurTube";

const OP_HANDSHAKE: u32 = 0;
const OP_FRAME: u32 = 1;
const OP_CLOSE: u32 = 2;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscordUserInfo {
    pub id: String,
    pub name: String,
    pub username: String,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct DiscordState {
    pub available: bool,
    pub connected: bool,
    pub enabled: bool,
    pub user: Option<DiscordUserInfo>,
    pub gateway: String,
    pub problem: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscordNowPlaying {
    pub video_id: String,
    pub title: String,
    pub artist: String,
    pub album: Option<String>,
    pub artwork_url: Option<String>,
    pub position_ms: f64,
    pub duration_ms: f64,
    pub playback_rate: Option<f64>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscordPresenceOptions {
    pub activity_type: Option<String>,
    pub use_details: Option<bool>,
    pub activity_name: Option<String>,
    pub show_elapsed: Option<bool>,
    pub show_artwork: Option<bool>,
    pub show_buttons: Option<bool>,
    pub button1_text: Option<String>,
    pub button1_visible: Option<bool>,
    pub button2_text: Option<String>,
    pub button2_visible: Option<bool>,
    pub incognito: Option<bool>,
}

#[derive(Debug, Default, Deserialize)]
pub struct DiscordSetPresencePayload {
    pub track: Option<DiscordNowPlaying>,
    #[serde(default)]
    pub options: DiscordPresenceOptions,
}

struct IpcClient {
    pipe: Option<File>,
    user: Option<DiscordUserInfo>,
    enabled: bool,
    manually_disconnected: bool,
    problem: Option<String>,
    nonce: u64,
}

fn ipc_state() -> &'static Mutex<IpcClient> {
    static STATE: OnceLock<Mutex<IpcClient>> = OnceLock::new();
    STATE.get_or_init(|| {
        Mutex::new(IpcClient {
            pipe: None,
            user: None,
            enabled: true,
            manually_disconnected: false,
            problem: None,
            nonce: 1,
        })
    })
}

fn write_frame(pipe: &mut File, opcode: u32, payload: &Value) -> Result<(), String> {
    let bytes = serde_json::to_vec(payload).map_err(|e| e.to_string())?;
    let mut header = [0u8; 8];
    header[..4].copy_from_slice(&opcode.to_le_bytes());
    header[4..8].copy_from_slice(&(bytes.len() as u32).to_le_bytes());
    pipe.write_all(&header).map_err(|e| e.to_string())?;
    pipe.write_all(&bytes).map_err(|e| e.to_string())?;
    pipe.flush().map_err(|e| e.to_string())?;
    Ok(())
}

fn read_frame(pipe: &mut File) -> Result<(u32, Value), String> {
    let mut header = [0u8; 8];
    pipe.read_exact(&mut header).map_err(|e| e.to_string())?;
    let opcode = u32::from_le_bytes([header[0], header[1], header[2], header[3]]);
    let len = u32::from_le_bytes([header[4], header[5], header[6], header[7]]) as usize;
    if len > 4 * 1024 * 1024 {
        return Err("Discord IPC frame too large".into());
    }
    let mut buf = vec![0u8; len];
    pipe.read_exact(&mut buf).map_err(|e| e.to_string())?;
    let val: Value = serde_json::from_slice(&buf).map_err(|e| e.to_string())?;
    Ok((opcode, val))
}

fn parse_ready_user(frame: &Value) -> DiscordUserInfo {
    if let Some(u) = frame.get("data").and_then(|d| d.get("user")) {
        let id = u
            .get("id")
            .and_then(|v| v.as_str())
            .unwrap_or("discord-ipc")
            .to_string();
        let username = u
            .get("username")
            .and_then(|v| v.as_str())
            .unwrap_or("discord")
            .to_string();
        let name = u
            .get("global_name")
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
            .unwrap_or(&username)
            .to_string();
        let avatar_url = u
            .get("avatar")
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
            .map(|av| format!("https://cdn.discordapp.com/avatars/{id}/{av}.png"));
        return DiscordUserInfo {
            id,
            name,
            username,
            avatar_url,
        };
    }
    DiscordUserInfo {
        id: "discord-ipc".into(),
        name: "Discord Desktop".into(),
        username: "discord".into(),
        avatar_url: None,
    }
}

fn open_and_handshake() -> Result<(File, DiscordUserInfo), String> {
    for i in 0..10 {
        let path = format!(r"\\.\pipe\discord-ipc-{i}");
        if let Ok(mut pipe) = OpenOptions::new().read(true).write(true).open(&path) {
            let hs = json!({
                "v": 1,
                "client_id": APPLICATION_ID
            });
            if write_frame(&mut pipe, OP_HANDSHAKE, &hs).is_ok() {
                if let Ok((_op, resp)) = read_frame(&mut pipe) {
                    let user = parse_ready_user(&resp);
                    return Ok((pipe, user));
                }
            }
        }
    }
    Err("Discord desktop app is not running. Open Discord and try again.".into())
}

fn ensure_connected(client: &mut IpcClient) -> Result<(), String> {
    if client.pipe.is_some() {
        return Ok(());
    }
    match open_and_handshake() {
        Ok((pipe, user)) => {
            client.pipe = Some(pipe);
            client.user = Some(user);
            client.problem = None;
            Ok(())
        }
        Err(e) => {
            client.problem = Some(e.clone());
            Err(e)
        }
    }
}

fn close_pipe(client: &mut IpcClient) {
    if let Some(mut pipe) = client.pipe.take() {
        let _ = write_frame(&mut pipe, OP_CLOSE, &json!({}));
    }
}

fn snapshot(client: &IpcClient) -> DiscordState {
    let connected = client.pipe.is_some() && client.user.is_some();
    DiscordState {
        available: true,
        connected,
        enabled: client.enabled,
        user: client.user.clone(),
        gateway: if connected && client.enabled {
            "ready".into()
        } else if client.problem.is_some() {
            "error".into()
        } else {
            "off".into()
        },
        problem: client.problem.clone(),
    }
}

fn resolve_vars(text: &str, track: &DiscordNowPlaying) -> String {
    text.replace("{song_name}", &track.title)
        .replace("{artist_name}", &track.artist)
        .replace("{album_name}", track.album.as_deref().unwrap_or(""))
}

fn truncate_str(s: &str, max_chars: usize) -> String {
    s.chars().take(max_chars).collect()
}

fn build_activity(track: &DiscordNowPlaying, opts: &DiscordPresenceOptions) -> Value {
    let now_secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    let rate = track
        .playback_rate
        .filter(|r| *r > 0.0)
        .unwrap_or(1.0);
    let watch_url = format!("https://music.youtube.com/watch?v={}", track.video_id);

    let act_type = match opts.activity_type.as_deref().unwrap_or("listening") {
        "playing" => 0,
        "watching" => 3,
        "competing" => 5,
        _ => 2,
    };

    let details = if (rate - 1.0).abs() > 0.01 {
        format!("{} [{:.2}x]", track.title, rate)
    } else {
        track.title.clone()
    };

    let mut activity = json!({
        "name": opts.activity_name.as_deref().map(str::trim).filter(|s| !s.is_empty()).unwrap_or(APP_NAME),
        "type": act_type,
        "status_display_type": if opts.use_details.unwrap_or(false) { 2 } else { 1 },
        "details": truncate_str(&details, 128),
        "details_url": watch_url,
        "state": truncate_str(&track.artist, 128),
    });

    if opts.show_elapsed.unwrap_or(true) {
        let start = now_secs - ((track.position_ms / 1000.0) / rate).round() as i64;
        let rem_ms = (track.duration_ms - track.position_ms).max(0.0);
        let end = now_secs + ((rem_ms / 1000.0) / rate).round() as i64;
        activity["timestamps"] = json!({
            "start": start,
            "end": end,
        });
    }

    if opts.show_artwork.unwrap_or(true) {
        if let Some(art) = track
            .artwork_url
            .as_deref()
            .filter(|u| u.starts_with("http"))
        {
            activity["assets"] = json!({
                "large_image": art,
                "large_text": truncate_str(track.album.as_deref().unwrap_or(APP_NAME), 128),
            });
        }
    }

    let show_buttons = opts.show_buttons.unwrap_or(true);
    let mut buttons = Vec::new();
    if show_buttons && opts.button1_visible.unwrap_or(true) {
        let label = opts
            .button1_text
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .unwrap_or(DEFAULT_BUTTON_1);
        buttons.push(json!({
            "label": truncate_str(&resolve_vars(label, track), 32),
            "url": watch_url,
        }));
    }
    if show_buttons && opts.button2_visible.unwrap_or(true) {
        let label = opts
            .button2_text
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .unwrap_or(DEFAULT_BUTTON_2);
        buttons.push(json!({
            "label": truncate_str(&resolve_vars(label, track), 32),
            "url": PROJECT_URL,
        }));
    }
    if !buttons.is_empty() {
        activity["buttons"] = Value::Array(buttons);
    }

    activity
}

fn send_set_activity(client: &mut IpcClient, activity: Option<Value>) -> Result<(), String> {
    client.nonce += 1;
    let frame = json!({
        "cmd": "SET_ACTIVITY",
        "args": {
            "pid": std::process::id(),
            "activity": activity,
        },
        "nonce": format!("ourtube-{}", client.nonce),
    });

    let pipe = client.pipe.as_mut().ok_or_else(|| "not connected".to_string())?;
    write_frame(pipe, OP_FRAME, &frame)?;
    let _ = read_frame(pipe)?;
    Ok(())
}

#[tauri::command]
pub async fn discord_state() -> DiscordState {
    tauri::async_runtime::spawn_blocking(|| {
        let mut c = ipc_state().lock().unwrap();
        if c.enabled && !c.manually_disconnected && c.pipe.is_none() {
            let _ = ensure_connected(&mut c);
        }
        snapshot(&c)
    })
    .await
    .unwrap_or(DiscordState {
        available: true,
        connected: false,
        enabled: false,
        user: None,
        gateway: "off".into(),
        problem: None,
    })
}

#[tauri::command]
pub async fn discord_connect() -> Result<DiscordState, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let mut c = ipc_state().lock().unwrap();
        c.manually_disconnected = false;
        c.enabled = true;
        close_pipe(&mut c);
        ensure_connected(&mut c)?;
        Ok(snapshot(&c))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn discord_disconnect() -> DiscordState {
    tauri::async_runtime::spawn_blocking(|| {
        let mut c = ipc_state().lock().unwrap();
        let _ = send_set_activity(&mut c, None);
        close_pipe(&mut c);
        c.user = None;
        c.manually_disconnected = true;
        c.problem = None;
        snapshot(&c)
    })
    .await
    .unwrap()
}

#[tauri::command]
pub async fn discord_set_enabled(enabled: bool) -> DiscordState {
    tauri::async_runtime::spawn_blocking(move || {
        let mut c = ipc_state().lock().unwrap();
        c.enabled = enabled;
        if !enabled {
            let _ = send_set_activity(&mut c, None);
            close_pipe(&mut c);
        } else if !c.manually_disconnected {
            let _ = ensure_connected(&mut c);
        }
        snapshot(&c)
    })
    .await
    .unwrap()
}

#[tauri::command]
pub async fn discord_set_presence(payload: DiscordSetPresencePayload) -> DiscordState {
    tauri::async_runtime::spawn_blocking(move || {
        let mut c = ipc_state().lock().unwrap();
        if !c.enabled || c.manually_disconnected || payload.options.incognito.unwrap_or(false) {
            if c.pipe.is_some() {
                let _ = send_set_activity(&mut c, None);
            }
            return snapshot(&c);
        }

        let Some(track) = payload.track else {
            if c.pipe.is_some() {
                let _ = send_set_activity(&mut c, None);
            }
            return snapshot(&c);
        };

        if ensure_connected(&mut c).is_err() {
            return snapshot(&c);
        }

        let activity = build_activity(&track, &payload.options);
        if send_set_activity(&mut c, Some(activity.clone())).is_err() {
            // Reconnect once if Discord restarted and replaced the pipe
            close_pipe(&mut c);
            if ensure_connected(&mut c).is_ok() {
                let _ = send_set_activity(&mut c, Some(activity));
            }
        }
        snapshot(&c)
    })
    .await
    .unwrap()
}
