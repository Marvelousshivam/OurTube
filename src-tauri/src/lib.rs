mod proxy;
mod stream;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|_app| {
            stream::start();
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            proxy::proxy_fetch,
            stream::stream_port
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
