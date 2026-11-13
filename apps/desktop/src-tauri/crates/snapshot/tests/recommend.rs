//! 手元のスナップショットでの提案計算。スナップショットが無いときと、不正なリクエストのときのエラー。

mod support;

use draftgg_engine::{RecommendationRequest, RequestError};
use draftgg_snapshot::{recommend_with, RecommendError, SnapshotService, SnapshotStore};
use serde_json::json;
use support::snapshot_body;

fn request(extra: serde_json::Value) -> RecommendationRequest {
    let empty = json!({"top": null, "jungle": null, "mid": null, "adc": null, "support": null});
    let mut body = json!({
        "draft": {
            "format": "ranked", "mySide": "blue", "actions": [],
            "assignments": {"blue": empty.clone(), "red": empty},
            "me": {"side": "blue", "position": "mid"},
        }
    });
    for (key, value) in extra.as_object().unwrap() {
        body[key] = value.clone();
    }
    serde_json::from_value(body).unwrap()
}

fn service_with_cache(dir: &std::path::Path) -> SnapshotService {
    SnapshotStore::new(dir)
        .save(&snapshot_body("16.22"), Some("\"v1\""))
        .unwrap();
    SnapshotService::open("http://127.0.0.1:9", SnapshotStore::new(dir))
}

#[test]
fn スナップショットが無ければ_snapshot_unavailable() {
    let dir = tempfile::tempdir().unwrap();
    let service = SnapshotService::open("http://127.0.0.1:9", SnapshotStore::new(dir.path()));

    let error = recommend_with(&service, &request(json!({}))).unwrap_err();
    assert_eq!(error, RecommendError::NoSnapshot);
    assert_eq!(error.to_string(), "snapshot_unavailable");
}

#[test]
fn キャッシュがあれば計算して_パッチを返す() {
    let dir = tempfile::tempdir().unwrap();
    let service = service_with_cache(dir.path());

    let response = recommend_with(&service, &request(json!({}))).unwrap();
    assert_eq!(response.patch.as_deref(), Some("16.22"));
    assert_eq!(response.tier, "diamond_plus");
}

#[test]
fn 不正なリクエストは_invalid_request() {
    let dir = tempfile::tempdir().unwrap();
    let service = service_with_cache(dir.path());

    let error = recommend_with(&service, &request(json!({"limit": 99}))).unwrap_err();
    assert_eq!(
        error,
        RecommendError::InvalidRequest(RequestError::InvalidLimit)
    );
    assert_eq!(error.to_string(), "invalid_request");
}

#[test]
fn 状態はパッチの有無を返す() {
    let dir = tempfile::tempdir().unwrap();
    let empty = SnapshotService::open("http://127.0.0.1:9", SnapshotStore::new(dir.path()));
    assert_eq!(empty.status().patch, None);
    assert!(!empty.status().loaded);

    let dir = tempfile::tempdir().unwrap();
    let loaded = service_with_cache(dir.path());
    assert_eq!(loaded.status().patch.as_deref(), Some("16.22"));
    assert!(loaded.status().loaded);
}
