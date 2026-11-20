//! LoL クライアントの監視(`draftgg-lcu`)を、アプリの起動中にバックグラウンドで動かし、
//! 状態の変化を画面へイベントで届ける。画面が後から開いても最新の状態を取れるよう、直近の状態も持つ。

use std::sync::{Arc, Mutex, PoisonError};

use draftgg_lcu::LcuState;
use tauri::{AppHandle, Emitter, Manager};

/// 画面が購読するイベント名。ペイロードは `LcuState`
pub const LCU_STATE_EVENT: &str = "lcu-state";

/// 直近の状態。画面の起動時に `lcu_state` コマンドで読む
#[derive(Clone)]
pub struct LcuStore(Arc<Mutex<LcuState>>);

impl LcuStore {
    fn new() -> Self {
        Self(Arc::new(Mutex::new(LcuState::Disconnected)))
    }

    pub fn current(&self) -> LcuState {
        self.0
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .clone()
    }

    fn set(&self, state: LcuState) {
        *self.0.lock().unwrap_or_else(PoisonError::into_inner) = state;
    }
}

/// 監視を始める。`setup` から 1 回だけ呼ぶ
pub fn start(app: &AppHandle) {
    let store = LcuStore::new();
    app.manage(store.clone());

    let handle = app.clone();
    tauri::async_runtime::spawn(draftgg_lcu::run(move |state| {
        store.set(state.clone());
        if let Err(error) = handle.emit(LCU_STATE_EVENT, &state) {
            eprintln!("LCU の状態を画面に送れませんでした: {error}");
        }
    }));
}
