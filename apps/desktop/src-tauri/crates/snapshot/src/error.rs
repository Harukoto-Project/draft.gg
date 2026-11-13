use std::fmt;

/// スナップショットの取得に失敗した理由。`Display` は画面側に渡すエラーコード
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SnapshotError {
    /// 接続できない・タイムアウトなど
    Network(String),
    /// api は動いているが、まだ統計を読み込んでいない(503)
    Unavailable,
    /// 想定外の HTTP ステータス
    Status(u16),
    /// 本文が統計スナップショットの形ではない
    InvalidBody,
}

impl fmt::Display for SnapshotError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            SnapshotError::Network(_) => write!(f, "snapshot_network_error"),
            SnapshotError::Unavailable => write!(f, "snapshot_unavailable"),
            SnapshotError::Status(_) => write!(f, "snapshot_bad_status"),
            SnapshotError::InvalidBody => write!(f, "snapshot_invalid_body"),
        }
    }
}

impl std::error::Error for SnapshotError {}
