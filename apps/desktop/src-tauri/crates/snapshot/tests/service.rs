//! api(`GET /api/snapshot`)との同期。ETag・キャッシュ・失敗時の挙動を、小さな HTTP サーバーで確かめる。

mod support;

use draftgg_snapshot::{RefreshOutcome, SnapshotError, SnapshotService, SnapshotStore};
use support::{snapshot_body, MockServer, Reply};

fn patch_of(service: &SnapshotService) -> Option<String> {
    service
        .current()
        .and_then(|snapshot| snapshot.patch.clone())
}

#[tokio::test]
async fn 最初の取得では_etag_を付けずに問い合わせ_保存して使えるようにする() {
    let server = MockServer::start(vec![Reply::ok(&snapshot_body("16.22"), "\"v1\"")]).await;
    let dir = tempfile::tempdir().unwrap();
    let service = SnapshotService::open(&server.base_url, SnapshotStore::new(dir.path()));
    assert!(service.current().is_none());

    assert_eq!(service.refresh().await.unwrap(), RefreshOutcome::Updated);

    assert_eq!(patch_of(&service).as_deref(), Some("16.22"));
    assert!(!server.requests()[0].contains_key("if-none-match"));
    let saved = SnapshotStore::new(dir.path()).load().unwrap();
    assert_eq!(saved.etag.as_deref(), Some("\"v1\""));
}

#[tokio::test]
async fn 次の取得は_etag_を付け_304_なら手元のものを使い続ける() {
    let server = MockServer::start(vec![
        Reply::ok(&snapshot_body("16.22"), "\"v1\""),
        Reply::status(304),
    ])
    .await;
    let dir = tempfile::tempdir().unwrap();
    let service = SnapshotService::open(&server.base_url, SnapshotStore::new(dir.path()));
    service.refresh().await.unwrap();

    assert_eq!(
        service.refresh().await.unwrap(),
        RefreshOutcome::NotModified
    );

    assert_eq!(server.requests()[1]["if-none-match"], "\"v1\"");
    assert_eq!(patch_of(&service).as_deref(), Some("16.22"));
}

#[tokio::test]
async fn 内容が変わっていれば入れ替えて保存し直す() {
    let server = MockServer::start(vec![
        Reply::ok(&snapshot_body("16.22"), "\"v1\""),
        Reply::ok(&snapshot_body("16.23"), "\"v2\""),
    ])
    .await;
    let dir = tempfile::tempdir().unwrap();
    let service = SnapshotService::open(&server.base_url, SnapshotStore::new(dir.path()));
    service.refresh().await.unwrap();

    assert_eq!(service.refresh().await.unwrap(), RefreshOutcome::Updated);

    assert_eq!(patch_of(&service).as_deref(), Some("16.23"));
    assert_eq!(
        SnapshotStore::new(dir.path())
            .load()
            .unwrap()
            .etag
            .as_deref(),
        Some("\"v2\"")
    );
}

#[tokio::test]
async fn 起動時にディスクのキャッシュを読み_その_etag_で問い合わせる() {
    let dir = tempfile::tempdir().unwrap();
    SnapshotStore::new(dir.path())
        .save(&snapshot_body("16.21"), Some("\"disk\""))
        .unwrap();
    let server = MockServer::start(vec![Reply::status(304)]).await;

    let service = SnapshotService::open(&server.base_url, SnapshotStore::new(dir.path()));
    assert_eq!(patch_of(&service).as_deref(), Some("16.21"));

    assert_eq!(
        service.refresh().await.unwrap(),
        RefreshOutcome::NotModified
    );
    assert_eq!(server.requests()[0]["if-none-match"], "\"disk\"");
}

#[tokio::test]
async fn api_が_503_なら_エラーを返し_手元のものは残す() {
    let dir = tempfile::tempdir().unwrap();
    SnapshotStore::new(dir.path())
        .save(&snapshot_body("16.21"), Some("\"disk\""))
        .unwrap();
    let server = MockServer::start(vec![Reply::status(503)]).await;
    let service = SnapshotService::open(&server.base_url, SnapshotStore::new(dir.path()));

    assert_eq!(
        service.refresh().await.unwrap_err(),
        SnapshotError::Unavailable
    );
    assert_eq!(patch_of(&service).as_deref(), Some("16.21"));
}

#[tokio::test]
async fn 想定外のステータスはエラーにする() {
    let server = MockServer::start(vec![Reply::status(500)]).await;
    let dir = tempfile::tempdir().unwrap();
    let service = SnapshotService::open(&server.base_url, SnapshotStore::new(dir.path()));

    assert_eq!(
        service.refresh().await.unwrap_err(),
        SnapshotError::Status(500)
    );
    assert!(service.current().is_none());
}

#[tokio::test]
async fn 接続できなくても_ディスクのキャッシュで動き続ける() {
    let dir = tempfile::tempdir().unwrap();
    SnapshotStore::new(dir.path())
        .save(&snapshot_body("16.21"), Some("\"disk\""))
        .unwrap();
    // 何も待ち受けていないポート
    let service = SnapshotService::open("http://127.0.0.1:9", SnapshotStore::new(dir.path()));

    assert!(matches!(
        service.refresh().await.unwrap_err(),
        SnapshotError::Network(_)
    ));
    assert_eq!(patch_of(&service).as_deref(), Some("16.21"));
}

#[tokio::test]
async fn 本文が統計の形でなければエラーにし_保存も入れ替えもしない() {
    let server = MockServer::start(vec![Reply::ok("{\"hello\":1}", "\"bad\"")]).await;
    let dir = tempfile::tempdir().unwrap();
    let service = SnapshotService::open(&server.base_url, SnapshotStore::new(dir.path()));

    assert_eq!(
        service.refresh().await.unwrap_err(),
        SnapshotError::InvalidBody
    );
    assert!(service.current().is_none());
    assert!(SnapshotStore::new(dir.path()).load().is_none());
}
