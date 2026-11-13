//! 手元のスナップショットで提案を計算する。Tauri のコマンドは、これを呼ぶだけにする。

use std::fmt;

use draftgg_engine::{
    recommend_for_request, RecommendationRequest, RecommendationResponse, RequestError,
};

use crate::service::SnapshotService;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RecommendError {
    /// まだ一度もスナップショットを取得できていない(キャッシュも無い)
    NoSnapshot,
    /// リクエストの値が範囲外
    InvalidRequest(RequestError),
}

/// `Display` は画面側に渡すエラーコード
impl fmt::Display for RecommendError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            RecommendError::NoSnapshot => write!(f, "snapshot_unavailable"),
            RecommendError::InvalidRequest(_) => write!(f, "invalid_request"),
        }
    }
}

impl std::error::Error for RecommendError {}

pub fn recommend_with(
    service: &SnapshotService,
    request: &RecommendationRequest,
) -> Result<RecommendationResponse, RecommendError> {
    let snapshot = service.current().ok_or(RecommendError::NoSnapshot)?;
    recommend_for_request(&snapshot, request).map_err(RecommendError::InvalidRequest)
}
