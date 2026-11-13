//! 画面から呼ぶ Tauri コマンド。ロジックは各 crate にあり、ここは結び付けだけにする。
//! 1 つの機能群 = 1 ファイル。増やしたら `lib.rs` の `generate_handler!` に足す。

pub mod drafts;
pub mod profiles;
pub mod snapshot;
pub mod teams;
