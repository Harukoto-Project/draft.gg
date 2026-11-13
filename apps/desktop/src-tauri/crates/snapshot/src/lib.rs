//! api の `GET /api/snapshot` を取り込み、ETag つきでアプリのデータフォルダにキャッシュする。
//! Tauri には依存しない。コマンドへの結び付けは `apps/desktop/src-tauri/src` が行う。

mod error;
mod recommend;
mod service;
mod store;

pub use error::SnapshotError;
pub use recommend::{recommend_with, RecommendError};
pub use service::{RefreshOutcome, SnapshotService, SnapshotStatus};
pub use store::{CachedSnapshot, SnapshotStore};
