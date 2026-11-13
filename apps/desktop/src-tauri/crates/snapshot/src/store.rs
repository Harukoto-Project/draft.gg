//! キャッシュのファイル。本文(`snapshot.json`)と ETag(`snapshot.etag`)を別に持つ。

use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use draftgg_engine::StatsSnapshot;

#[derive(Debug, Clone)]
pub struct CachedSnapshot {
    pub snapshot: Arc<StatsSnapshot>,
    pub etag: Option<String>,
}

pub struct SnapshotStore {
    dir: PathBuf,
}

impl SnapshotStore {
    pub fn new(dir: impl Into<PathBuf>) -> Self {
        SnapshotStore { dir: dir.into() }
    }

    /// 読めない・壊れているキャッシュは無いものとして扱う
    pub fn load(&self) -> Option<CachedSnapshot> {
        let body = fs::read_to_string(self.body_path()).ok()?;
        let snapshot: StatsSnapshot = serde_json::from_str(&body).ok()?;
        let etag = fs::read_to_string(self.etag_path())
            .ok()
            .map(|text| text.trim().to_string())
            .filter(|text| !text.is_empty());
        Some(CachedSnapshot {
            snapshot: Arc::new(snapshot),
            etag,
        })
    }

    /// 本文と ETag を保存する。途中で止まっても壊れたファイルが残らないよう、一時ファイルに書いてから置き換える
    pub fn save(&self, body: &str, etag: Option<&str>) -> io::Result<()> {
        fs::create_dir_all(&self.dir)?;
        // ETag を先に消す。本文だけ新しく ETag が古い状態で止まると、次の問い合わせが 304 になり古いまま残るため
        match fs::remove_file(self.etag_path()) {
            Ok(()) => {}
            Err(error) if error.kind() == io::ErrorKind::NotFound => {}
            Err(error) => return Err(error),
        }
        write_atomic(&self.body_path(), body)?;
        if let Some(etag) = etag {
            write_atomic(&self.etag_path(), etag)?;
        }
        Ok(())
    }

    fn body_path(&self) -> PathBuf {
        self.dir.join("snapshot.json")
    }

    fn etag_path(&self) -> PathBuf {
        self.dir.join("snapshot.etag")
    }
}

fn write_atomic(path: &Path, contents: &str) -> io::Result<()> {
    let temporary = path.with_extension("tmp");
    fs::write(&temporary, contents)?;
    fs::rename(&temporary, path)
}

#[cfg(test)]
mod tests {
    use super::*;

    const BODY: &str = r#"{"patch":"16.22","tier":"diamond_plus","champions":[],"meta":[],"matchups":[],"synergies":[],"pro":[]}"#;

    #[test]
    fn 保存した本文と_etag_を読み戻せる() {
        let dir = tempfile::tempdir().unwrap();
        let store = SnapshotStore::new(dir.path());
        store.save(BODY, Some("\"abc\"")).unwrap();

        let loaded = store.load().unwrap();
        assert_eq!(loaded.snapshot.patch.as_deref(), Some("16.22"));
        assert_eq!(loaded.etag.as_deref(), Some("\"abc\""));
    }

    #[test]
    fn 何も保存していなければ_none() {
        let dir = tempfile::tempdir().unwrap();
        assert!(SnapshotStore::new(dir.path()).load().is_none());
    }

    #[test]
    fn 保存先のフォルダが無ければ作る() {
        let dir = tempfile::tempdir().unwrap();
        let store = SnapshotStore::new(dir.path().join("nested").join("cache"));
        store.save(BODY, None).unwrap();
        assert!(store.load().is_some());
    }

    #[test]
    fn etag_が無い保存は_etag_なしで読める() {
        let dir = tempfile::tempdir().unwrap();
        let store = SnapshotStore::new(dir.path());
        store.save(BODY, Some("\"old\"")).unwrap();
        store.save(BODY, None).unwrap();
        assert_eq!(store.load().unwrap().etag, None);
    }

    #[test]
    fn 壊れた本文は_none_として扱う() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("snapshot.json"), "{ not json").unwrap();
        assert!(SnapshotStore::new(dir.path()).load().is_none());
    }

    #[test]
    fn 上書きすると新しい内容を読める() {
        let dir = tempfile::tempdir().unwrap();
        let store = SnapshotStore::new(dir.path());
        store.save(BODY, Some("\"a\"")).unwrap();
        store
            .save(&BODY.replace("16.22", "16.23"), Some("\"b\""))
            .unwrap();

        let loaded = store.load().unwrap();
        assert_eq!(loaded.snapshot.patch.as_deref(), Some("16.23"));
        assert_eq!(loaded.etag.as_deref(), Some("\"b\""));
    }
}
