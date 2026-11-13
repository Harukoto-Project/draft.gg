//! 入力の検証。規則は TS 版の zod スキーマと同じ。

use std::collections::HashSet;

use draftgg_engine::Position;
use serde_json::Value;

use crate::error::StorageError;
use crate::model::*;

const NAME_MAX: usize = 50;
const GAME_NAME_MAX: usize = 16;
const TAG_LINE_MAX: usize = 5;

fn invalid<T>(reason: &'static str) -> Result<T, StorageError> {
    Err(StorageError::Invalid(reason))
}

/// プレイヤー名・チーム名。前後の空白を除いて 1〜50 文字
pub fn name(value: &str) -> Result<String, StorageError> {
    let trimmed = value.trim();
    let length = trimmed.chars().count();
    if length == 0 || length > NAME_MAX {
        return invalid("name_length");
    }
    Ok(trimmed.to_string())
}

/// `ゲーム名#タグ`。最後の `#` で分け、ゲーム名 1〜16 文字(`#` を含まない)、タグ 1〜5 文字
pub fn riot_id(value: Option<String>) -> Result<Option<String>, StorageError> {
    let Some(value) = value else { return Ok(None) };
    let text = value.trim();
    if text.chars().count() > GAME_NAME_MAX + TAG_LINE_MAX + 1 {
        return invalid("riot_id");
    }
    let Some(index) = text.rfind('#') else {
        return invalid("riot_id");
    };
    let game_name = text[..index].trim();
    let tag_line = text[index + 1..].trim();
    let game_name_length = game_name.chars().count();
    let tag_line_length = tag_line.chars().count();
    if !(1..=GAME_NAME_MAX).contains(&game_name_length)
        || game_name.contains('#')
        || !(1..=TAG_LINE_MAX).contains(&tag_line_length)
    {
        return invalid("riot_id");
    }
    Ok(Some(text.to_string()))
}

pub fn region(value: Option<String>) -> Result<Option<String>, StorageError> {
    match value {
        Some(region) if !RIOT_REGIONS.contains(&region.as_str()) => invalid("region"),
        other => Ok(other),
    }
}

pub fn roles(values: &[Position]) -> Result<(), StorageError> {
    let unique: HashSet<_> = values.iter().collect();
    if unique.len() != values.len() {
        return invalid("roles_duplicated");
    }
    Ok(())
}

/// 最大 100 件、同じチャンピオン × ロールは重複させない。勝率は 0〜1
pub fn pool(entries: &[PoolEntry]) -> Result<(), StorageError> {
    if entries.len() > MAX_POOL_ENTRIES {
        return invalid("pool_too_large");
    }
    let mut seen = HashSet::new();
    for entry in entries {
        let id_length = entry.champion_id.chars().count();
        if id_length == 0 || id_length > ID_MAX_LENGTH {
            return invalid("champion_id");
        }
        if let Some(rate) = entry.win_rate {
            if !(0.0..=1.0).contains(&rate) {
                return invalid("win_rate");
            }
        }
        if !seen.insert((entry.champion_id.as_str(), entry.position)) {
            return invalid("pool_duplicated");
        }
    }
    Ok(())
}

/// 同じプレイヤーを複数のロールに割り当てられない
pub fn team_members(members: &TeamMembers) -> Result<(), StorageError> {
    let ids: HashSet<_> = members.values().collect();
    if ids.len() != members.len() {
        return invalid("members_duplicated");
    }
    Ok(())
}

/// 保存ドラフトのメモ(前後の空白を除いて 200 文字まで)と、状態がオブジェクトであること
pub fn draft(state: &Value, note: &str) -> Result<String, StorageError> {
    if !state.is_object() {
        return invalid("draft_state");
    }
    let trimmed = note.trim();
    if trimmed.chars().count() > DRAFT_NOTE_MAX_LENGTH {
        return invalid("draft_note");
    }
    Ok(trimmed.to_string())
}
