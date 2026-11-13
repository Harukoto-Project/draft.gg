use std::fmt;

/// 操作に失敗した理由。`Display` は画面側に渡すエラーコード
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StorageError {
    /// 指定した id のデータが無い
    NotFound,
    /// 入力が規則に合わない(文字数・形式・重複・範囲など)
    Invalid(&'static str),
    /// 保存できる件数の上限に達している
    Limit,
    /// チームに、存在しないプレイヤーが割り当てられている
    UnknownProfile,
    /// ファイルへの保存に失敗した
    Io(String),
}

impl fmt::Display for StorageError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            StorageError::NotFound => write!(f, "not_found"),
            StorageError::Invalid(_) => write!(f, "invalid_input"),
            StorageError::Limit => write!(f, "limit_reached"),
            StorageError::UnknownProfile => write!(f, "unknown_profile"),
            StorageError::Io(_) => write!(f, "storage_io_error"),
        }
    }
}

impl std::error::Error for StorageError {}
