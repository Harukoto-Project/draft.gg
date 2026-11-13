use std::collections::HashSet;
use std::fs;
use std::io;
use std::path::PathBuf;
use std::sync::{Mutex, MutexGuard};

use chrono::{SecondsFormat, Utc};
use uuid::Uuid;

use crate::error::StorageError;
use crate::model::*;
use crate::validate;

pub struct Storage {
    path: PathBuf,
    data: Mutex<UserData>,
}

impl Storage {
    /// `dir` に `userdata.json` を置く。読めない・壊れているときは、壊れたものを退避して空から始める
    pub fn open(dir: impl Into<PathBuf>) -> Storage {
        let path = dir.into().join("userdata.json");
        let data = load(&path);
        Storage {
            path,
            data: Mutex::new(data),
        }
    }

    // ---- プレイヤー ----

    pub fn list_profiles(&self) -> Vec<Profile> {
        self.read().profiles.clone()
    }

    pub fn create_profile(&self, input: ProfileInput) -> Result<Profile, StorageError> {
        let display_name = validate::name(&input.display_name)?;
        let riot_id = validate::riot_id(input.riot_id)?;
        let region = validate::region(input.region)?;
        validate::roles(&input.roles)?;

        self.mutate(|data| {
            if data.profiles.len() >= MAX_PROFILES {
                return Err(StorageError::Limit);
            }
            let profile = Profile {
                id: Uuid::new_v4().to_string(),
                display_name,
                riot_id,
                region,
                roles: input.roles,
                synced_at: None,
                pool: Vec::new(),
            };
            data.profiles.push(profile.clone());
            Ok(profile)
        })
    }

    pub fn update_profile(&self, id: &str, patch: ProfilePatch) -> Result<Profile, StorageError> {
        let display_name = patch
            .display_name
            .as_deref()
            .map(validate::name)
            .transpose()?;
        let riot_id = patch.riot_id.map(validate::riot_id).transpose()?;
        let region = patch.region.map(validate::region).transpose()?;
        if let Some(roles) = &patch.roles {
            validate::roles(roles)?;
        }

        self.mutate(|data| {
            let profile = find_mut(&mut data.profiles, id, |profile| &profile.id)?;
            if let Some(display_name) = display_name {
                profile.display_name = display_name;
            }
            if let Some(riot_id) = riot_id {
                profile.riot_id = riot_id;
            }
            if let Some(region) = region {
                profile.region = region;
            }
            if let Some(roles) = patch.roles {
                profile.roles = roles;
            }
            Ok(profile.clone())
        })
    }

    /// プレイヤーを消し、チームの割り当てからも外す
    pub fn delete_profile(&self, id: &str) -> Result<(), StorageError> {
        self.mutate(|data| {
            let before = data.profiles.len();
            data.profiles.retain(|profile| profile.id != id);
            if data.profiles.len() == before {
                return Err(StorageError::NotFound);
            }
            for team in &mut data.teams {
                team.members.retain(|_, profile_id| profile_id != id);
            }
            Ok(())
        })
    }

    pub fn set_pool(&self, id: &str, entries: Vec<PoolEntry>) -> Result<Profile, StorageError> {
        validate::pool(&entries)?;
        self.mutate(|data| {
            let profile = find_mut(&mut data.profiles, id, |profile| &profile.id)?;
            profile.pool = entries;
            Ok(profile.clone())
        })
    }

    /// OP.GG から取り直したプールを反映する。手動で足したものは残し、OP.GG 由来は入れ替える
    ///
    /// 同じチャンピオン × ロールが手動にもあれば手動を優先し、除外の指定は引き続き出てくるものに引き継ぐ。
    /// 手動と合わせて 100 件を超える分は捨てる(TS 版の `mergeSyncedPool` と同じ)。
    pub fn apply_pool_sync(
        &self,
        id: &str,
        synced: Vec<PoolEntry>,
    ) -> Result<Profile, StorageError> {
        self.mutate(|data| {
            let profile = find_mut(&mut data.profiles, id, |profile| &profile.id)?;
            let pool = merge_synced_pool(&profile.pool, synced);
            validate::pool(&pool)?;
            profile.pool = pool;
            profile.synced_at = Some(Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true));
            Ok(profile.clone())
        })
    }
    // ---- チーム ----

    pub fn list_teams(&self) -> Vec<Team> {
        self.read().teams.clone()
    }

    pub fn create_team(&self, input: TeamInput) -> Result<Team, StorageError> {
        let name = validate::name(&input.name)?;
        validate::team_members(&input.members)?;

        self.mutate(|data| {
            if data.teams.len() >= MAX_TEAMS {
                return Err(StorageError::Limit);
            }
            ensure_profiles_exist(data, &input.members)?;
            let team = Team {
                id: Uuid::new_v4().to_string(),
                name,
                members: input.members,
            };
            data.teams.push(team.clone());
            Ok(team)
        })
    }

    pub fn update_team(&self, id: &str, patch: TeamPatch) -> Result<Team, StorageError> {
        let name = patch.name.as_deref().map(validate::name).transpose()?;
        if let Some(members) = &patch.members {
            validate::team_members(members)?;
        }

        self.mutate(|data| {
            if let Some(members) = &patch.members {
                ensure_profiles_exist(data, members)?;
            }
            let team = find_mut(&mut data.teams, id, |team| &team.id)?;
            if let Some(name) = name {
                team.name = name;
            }
            if let Some(members) = patch.members {
                team.members = members;
            }
            Ok(team.clone())
        })
    }

    pub fn delete_team(&self, id: &str) -> Result<(), StorageError> {
        self.mutate(|data| {
            let before = data.teams.len();
            data.teams.retain(|team| team.id != id);
            if data.teams.len() == before {
                return Err(StorageError::NotFound);
            }
            Ok(())
        })
    }

    // ---- 保存ドラフト ----

    /// 新しい順
    pub fn list_drafts(&self) -> Vec<SavedDraft> {
        self.read().drafts.iter().rev().cloned().collect()
    }

    pub fn save_draft(&self, input: SavedDraftInput) -> Result<SavedDraft, StorageError> {
        let note = validate::draft(&input.state, &input.note)?;
        self.mutate(|data| {
            if data.drafts.len() >= MAX_DRAFTS {
                return Err(StorageError::Limit);
            }
            let draft = SavedDraft {
                id: Uuid::new_v4().to_string(),
                state: input.state,
                note,
                created_at: Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true),
            };
            data.drafts.push(draft.clone());
            Ok(draft)
        })
    }

    pub fn delete_draft(&self, id: &str) -> Result<(), StorageError> {
        self.mutate(|data| {
            let before = data.drafts.len();
            data.drafts.retain(|draft| draft.id != id);
            if data.drafts.len() == before {
                return Err(StorageError::NotFound);
            }
            Ok(())
        })
    }

    // ---- 内部 ----

    fn read(&self) -> MutexGuard<'_, UserData> {
        self.data
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    /// 変更を写しに加えて保存し、成功したときだけ反映する。保存に失敗したらメモリ上も元のまま
    fn mutate<R>(
        &self,
        change: impl FnOnce(&mut UserData) -> Result<R, StorageError>,
    ) -> Result<R, StorageError> {
        let mut guard = self.read();
        let mut next = guard.clone();
        let result = change(&mut next)?;
        save(&self.path, &next).map_err(|error| StorageError::Io(error.to_string()))?;
        *guard = next;
        Ok(result)
    }
}

fn find_mut<'a, T>(
    items: &'a mut [T],
    id: &str,
    id_of: impl Fn(&T) -> &String,
) -> Result<&'a mut T, StorageError> {
    items
        .iter_mut()
        .find(|item| id_of(item) == id)
        .ok_or(StorageError::NotFound)
}

fn ensure_profiles_exist(data: &UserData, members: &TeamMembers) -> Result<(), StorageError> {
    let known = |id: &String| data.profiles.iter().any(|profile| &profile.id == id);
    if members.values().all(known) {
        Ok(())
    } else {
        Err(StorageError::UnknownProfile)
    }
}

fn load(path: &PathBuf) -> UserData {
    let Ok(text) = fs::read_to_string(path) else {
        return UserData::default();
    };
    match serde_json::from_str(&text) {
        Ok(data) => data,
        Err(_) => {
            // 壊れたファイルは消さずに退避する。次の保存で上書きされても、手で取り出せる
            let _ = fs::rename(path, path.with_file_name("userdata.corrupt.json"));
            UserData::default()
        }
    }
}

/// 途中で止まっても壊れたファイルが残らないよう、一時ファイルに書いてから置き換える
fn save(path: &PathBuf, data: &UserData) -> io::Result<()> {
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir)?;
    }
    let text = serde_json::to_string_pretty(data).map_err(io::Error::other)?;
    let temporary = path.with_extension("tmp");
    fs::write(&temporary, text)?;
    fs::rename(&temporary, path)
}

fn merge_synced_pool(existing: &[PoolEntry], synced: Vec<PoolEntry>) -> Vec<PoolEntry> {
    let key = |entry: &PoolEntry| (entry.champion_id.clone(), entry.position);
    let manual: Vec<PoolEntry> = existing
        .iter()
        .filter(|entry| entry.source == PoolSource::Manual)
        .cloned()
        .collect();
    let manual_keys: HashSet<_> = manual.iter().map(key).collect();
    let previously_excluded: HashSet<_> = existing
        .iter()
        .filter(|entry| entry.source == PoolSource::Opgg && entry.excluded)
        .map(key)
        .collect();

    let from_opgg = synced
        .into_iter()
        .filter(|entry| !manual_keys.contains(&key(entry)))
        .map(|mut entry| {
            entry.source = PoolSource::Opgg;
            entry.excluded = previously_excluded.contains(&key(&entry));
            entry
        });

    manual
        .into_iter()
        .chain(from_opgg)
        .take(MAX_POOL_ENTRIES)
        .collect()
}
