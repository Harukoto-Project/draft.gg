//! ウィンドウの下地(Windows 11 の Mica)。
//!
//! Mica が使えたかを画面に伝え、使えたときだけ下地を透明にしてもらう。
//! Windows 10 や macOS では適用に失敗するか対象外で、画面は単色の下地のまま動く。

use tauri::{AppHandle, Manager};

/// Mica を適用できたか。起動時に 1 度だけ決まる。
pub struct Backdrop {
    pub mica: bool,
}

/// メインウィンドウに Mica を適用する。適用できたら `true`。
#[cfg(windows)]
pub fn apply(app: &AppHandle) -> bool {
    let Some(window) = app.get_webview_window("main") else {
        return false;
    };
    // 引数 None はシステムの明暗に合わせる。アプリ側で明暗を選んだときは、画面から set_theme で揃える
    window_vibrancy::apply_mica(&window, None).is_ok()
}

#[cfg(not(windows))]
pub fn apply(_app: &AppHandle) -> bool {
    false
}

/// 画面が起動時に呼ぶ。`"mica"` なら下地を透明にする。
#[tauri::command]
pub fn window_backdrop(backdrop: tauri::State<'_, Backdrop>) -> &'static str {
    if backdrop.mica {
        "mica"
    } else {
        "none"
    }
}
