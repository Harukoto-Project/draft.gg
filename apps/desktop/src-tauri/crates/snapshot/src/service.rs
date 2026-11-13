use std::sync::{Arc, RwLock};
use std::time::Duration;

use draftgg_engine::StatsSnapshot;
use reqwest::header::{ETAG, IF_NONE_MATCH};
use reqwest::StatusCode;
use serde::Serialize;

use crate::error::SnapshotError;
use crate::store::{CachedSnapshot, SnapshotStore};

/// 約 575 KB(gzip で約 51 KB)の取得に十分な長さ
const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum RefreshOutcome {
    /// 新しいスナップショットに入れ替えた
    Updated,
    /// api の ETag と同じ。手元のものをそのまま使う
    NotModified,
}

/// 画面に見せる、手元のスナップショットの状態
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct SnapshotStatus {
    pub loaded: bool,
    pub patch: Option<String>,
}

pub struct SnapshotService {
    url: String,
    http: reqwest::Client,
    store: SnapshotStore,
    current: RwLock<Option<CachedSnapshot>>,
}

impl SnapshotService {
    /// `base_url` は api の根(例 `http://127.0.0.1:3001`)。ディスクにキャッシュがあれば読み込む
    pub fn open(base_url: &str, store: SnapshotStore) -> Self {
        let http = reqwest::Client::builder()
            .timeout(REQUEST_TIMEOUT)
            .build()
            .expect("HTTP クライアントを作れません");
        let current = store.load();
        SnapshotService {
            url: format!("{}/api/snapshot", base_url.trim_end_matches('/')),
            http,
            store,
            current: RwLock::new(current),
        }
    }

    pub fn current(&self) -> Option<Arc<StatsSnapshot>> {
        self.read().as_ref().map(|cached| cached.snapshot.clone())
    }

    pub fn status(&self) -> SnapshotStatus {
        let snapshot = self.current();
        SnapshotStatus {
            loaded: snapshot.is_some(),
            patch: snapshot.and_then(|snapshot| snapshot.patch.clone()),
        }
    }

    /// api に問い合わせて入れ替える。失敗しても、手元のスナップショットは消さない
    pub async fn refresh(&self) -> Result<RefreshOutcome, SnapshotError> {
        let etag = self.read().as_ref().and_then(|cached| cached.etag.clone());
        let mut request = self.http.get(&self.url);
        if let Some(etag) = &etag {
            request = request.header(IF_NONE_MATCH, etag);
        }

        let response = request
            .send()
            .await
            .map_err(|error| SnapshotError::Network(error.to_string()))?;

        match response.status() {
            StatusCode::NOT_MODIFIED => Ok(RefreshOutcome::NotModified),
            StatusCode::OK => {
                let new_etag = response
                    .headers()
                    .get(ETAG)
                    .and_then(|value| value.to_str().ok())
                    .map(str::to_string);
                let body = response
                    .text()
                    .await
                    .map_err(|error| SnapshotError::Network(error.to_string()))?;
                let snapshot: StatsSnapshot =
                    serde_json::from_str(&body).map_err(|_| SnapshotError::InvalidBody)?;

                // 保存に失敗しても(ディスク満杯など)、今回の取得はメモリ上で使える
                let _ = self.store.save(&body, new_etag.as_deref());
                *self.write() = Some(CachedSnapshot {
                    snapshot: Arc::new(snapshot),
                    etag: new_etag,
                });
                Ok(RefreshOutcome::Updated)
            }
            StatusCode::SERVICE_UNAVAILABLE => Err(SnapshotError::Unavailable),
            status => Err(SnapshotError::Status(status.as_u16())),
        }
    }

    fn read(&self) -> std::sync::RwLockReadGuard<'_, Option<CachedSnapshot>> {
        self.current
            .read()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    fn write(&self) -> std::sync::RwLockWriteGuard<'_, Option<CachedSnapshot>> {
        self.current
            .write()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}
