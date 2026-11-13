/// アプリの起動。コマンドやプラグインの登録は、ここに足す。
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .run(tauri::generate_context!())
        .expect("Draft.GG の起動に失敗しました");
}