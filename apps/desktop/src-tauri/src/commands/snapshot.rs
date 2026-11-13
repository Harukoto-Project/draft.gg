//! 画面から呼ぶ Tauri コマンド。ロジックは `draftgg-snapshot` / `draftgg-engine` にあり、ここは結び付けだけにする。

use std::sync::Arc;

use draftgg_engine::{RecommendationRequest, RecommendationResponse};
use draftgg_snapshot::{recommend_with, RefreshOutcome, SnapshotService, SnapshotStatus};
use serde::Serialize;
use tauri::State;

pub type SharedSnapshot = Arc<SnapshotService>;

#[derive(Serialize)]
pub struct RefreshReport {
    outcome: RefreshOutcome,
    status: SnapshotStatus,
}

/// 手元のスナップショットで提案を計算する。エラーは画面側が分岐できるコード(`snapshot_unavailable` など)
#[tauri::command]
pub async fn recommend(
    snapshot: State<'_, SharedSnapshot>,
    request: RecommendationRequest,
) -> Result<RecommendationResponse, String> {
    recommend_with(&snapshot, &request).map_err(|error| error.to_string())
}

/// api に問い合わせてスナップショットを更新する。失敗しても手元のものは残る
#[tauri::command]
pub async fn refresh_snapshot(
    snapshot: State<'_, SharedSnapshot>,
) -> Result<RefreshReport, String> {
    let service = Arc::clone(&snapshot);
    let outcome = service.refresh().await.map_err(|error| error.to_string())?;
    Ok(RefreshReport {
        outcome,
        status: service.status(),
    })
}

#[tauri::command]
pub fn snapshot_status(snapshot: State<'_, SharedSnapshot>) -> SnapshotStatus {
    snapshot.status()
}
