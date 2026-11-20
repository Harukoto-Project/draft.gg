//! LoL クライアント(LCU)のチャンピオンセレクトを監視し、ドラフト向けの形に整える。
//! Tauri には依存しない。画面への通知は `apps/desktop/src-tauri/src` が行う。

mod champ_select;
mod connection;
mod credentials;
mod error;
mod events;
mod session;
mod state;
mod watcher;

pub use champ_select::{
    BanEntry, ChampSelectSnapshot, DraftFormat, PickEntry, Position, Side, Unsupported,
};
pub use error::LcuError;
pub use state::LcuState;
pub use watcher::run;
