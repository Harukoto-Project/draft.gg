//! ユーザーデータ(プレイヤーとプール・チーム・保存ドラフト)を、アプリのデータフォルダの JSON に保存する。
//! 入力の検証は、TS 版(`@draftgg/shared` の zod スキーマと `packages/db` のストア)と同じ規則。
//! Tauri には依存しない。コマンドへの結び付けは `apps/desktop/src-tauri/src` が行う。

mod error;
mod model;
mod storage;
mod validate;

pub use error::StorageError;
pub use model::*;
pub use storage::Storage;
