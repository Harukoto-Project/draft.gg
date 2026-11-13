/// アプリの起動。コマンドやプラグインの登録は、ここに足す。
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        // Windows 11 のスナップレイアウト。自前の最大化ボタン(id は SNAP_BUTTON_ID と合わせる)の上に
        // 透明なネイティブ領域を重ねる。Windows 10 と macOS では何もしない
        .plugin(
            tauri_plugin_snap_layout::init()
                .button_id("snap-btn")
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("Draft.GG の起動に失敗しました");
}
