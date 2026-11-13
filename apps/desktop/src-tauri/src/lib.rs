mod commands;

use std::sync::Arc;

use draftgg_snapshot::{SnapshotService, SnapshotStore};
use tauri::Manager;

/// 統計スナップショットの取得元。リリースビルドは `DRAFTGG_API_URL` をビルド時に渡す。
/// 実行時に同名の環境変数があればそちらを優先する(開発・検証用)
const DEFAULT_API_URL: &str = match option_env!("DRAFTGG_API_URL") {
    Some(url) => url,
    None => "http://127.0.0.1:3001",
};

fn api_url() -> String {
    std::env::var("DRAFTGG_API_URL").unwrap_or_else(|_| DEFAULT_API_URL.to_string())
}

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
        .setup(|app| {
            // キャッシュはアプリのデータフォルダに置く。前回のものがあれば、api に届かなくても提案できる
            let dir = app.path().app_data_dir()?.join("snapshot");
            let service = SnapshotService::open(&api_url(), SnapshotStore::new(dir));
            app.manage(Arc::new(service));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::recommend,
            commands::refresh_snapshot,
            commands::snapshot_status,
        ])
        .run(tauri::generate_context!())
        .expect("Draft.GG の起動に失敗しました");
}
