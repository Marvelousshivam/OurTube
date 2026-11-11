mod addon;
mod auth;
mod dac;
mod discord;
mod lyrics;
mod proxy;
mod stream;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            auth::init(app.handle());
            stream::start();
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            auth::auth_signed_in,
            auth::auth_open_login,
            auth::auth_sign_out,
            proxy::proxy_fetch,
            stream::stream_port,
            stream::allow_stream_url,
            addon::addon_fetch,
            dac::dac_probe_device,
            dac::dac_state,
            dac::dac_play,
            dac::dac_pause,
            dac::dac_resume,
            dac::dac_seek,
            dac::dac_stop,
            lyrics::lyrics_fetch,
            discord::discord_state,
            discord::discord_connect,
            discord::discord_disconnect,
            discord::discord_set_enabled,
            discord::discord_set_presence,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
