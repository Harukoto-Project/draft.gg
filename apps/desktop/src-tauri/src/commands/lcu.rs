//! LoL クライアント(LCU)の状態。変化は `lcu-state` イベントで届くので、ここは起動時の初期値の取得だけ。

use draftgg_lcu::LcuState;
use tauri::State;

use crate::lcu_bridge::LcuStore;

#[tauri::command]
pub fn lcu_state(store: State<'_, LcuStore>) -> LcuState {
    store.current()
}
