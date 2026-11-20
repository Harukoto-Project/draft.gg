//! LCU のセッションを、ドラフト盤面に反映しやすい形に整える。
//! 扱うのはチャンピオン・ロール・サイドだけ。ランク戦で匿名化されている相手や味方の
//! 身元(サモナー名など)は読まない(Riot のサードパーティ方針)。
//!
//! 盤面の枠への割り当て(何手目か)は画面側が進行ルールから決めるので、
//! ここでは LCU の手順の並びを、サイドごとの順番を保ったまま返すだけにする。

use serde::Serialize;

use crate::session::{Action, Session};

/// ブルー側のセル番号は 0〜4、レッド側は 5〜9
const CELLS_PER_TEAM: i32 = 5;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Side {
    Blue,
    Red,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum DraftFormat {
    Ranked,
    Tournament,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Position {
    Top,
    Jungle,
    Mid,
    Adc,
    Support,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BanEntry {
    pub side: Side,
    /// Riot の数値 ID。未確定(選択中・BAN なし)は `None`
    pub champion_key: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PickEntry {
    pub side: Side,
    /// 確定したピックだけ入る。選択中(ホバー)は `None`
    pub champion_key: Option<u32>,
    /// 割り当てがわかるときだけ。ランク戦の相手は分からない
    pub position: Option<Position>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChampSelectSnapshot {
    pub format: DraftFormat,
    pub my_side: Side,
    pub my_position: Option<Position>,
    /// LCU のフェーズ名(`BAN_PICK` など)
    pub phase: String,
    pub bans: Vec<BanEntry>,
    pub picks: Vec<PickEntry>,
}

/// ドラフトとして扱えないセッション
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Unsupported {
    /// 観戦中(自分の枠がない)
    Spectator,
    /// BAN がないモード(ブラインドピックや ARAM など)
    NoBans,
}

impl ChampSelectSnapshot {
    pub fn from_session(session: &Session) -> Result<Self, Unsupported> {
        if session.local_player_cell_id < 0 {
            return Err(Unsupported::Spectator);
        }

        let ban_groups = || {
            session
                .actions
                .iter()
                .filter(|group| group.iter().any(|action| action.kind == "ban"))
        };
        if ban_groups().next().is_none() {
            return Err(Unsupported::NoBans);
        }
        // ランク戦は 10 人が同時に BAN する 1 グループ。大会形式は 1 手ずつ順番に BAN する
        let format = if ban_groups().any(|group| group.len() > 1) {
            DraftFormat::Ranked
        } else {
            DraftFormat::Tournament
        };

        let mut bans = Vec::new();
        let mut picks = Vec::new();
        for action in session.actions.iter().flatten() {
            let side = side_of(action.actor_cell_id);
            match action.kind.as_str() {
                "ban" => bans.push(BanEntry {
                    side,
                    champion_key: confirmed_key(action),
                }),
                "pick" => picks.push(PickEntry {
                    side,
                    champion_key: confirmed_key(action),
                    position: position_of(session, action.actor_cell_id),
                }),
                _ => {}
            }
        }

        Ok(Self {
            format,
            my_side: side_of(session.local_player_cell_id),
            my_position: position_of(session, session.local_player_cell_id),
            phase: session.timer.phase.clone(),
            bans,
            picks,
        })
    }
}

fn side_of(cell_id: i32) -> Side {
    if cell_id < CELLS_PER_TEAM {
        Side::Blue
    } else {
        Side::Red
    }
}

/// 確定した手のチャンピオン。選択中は `completed` が false、BAN なしは ID が 0 以下
fn confirmed_key(action: &Action) -> Option<u32> {
    if action.completed && action.champion_id > 0 {
        u32::try_from(action.champion_id).ok()
    } else {
        None
    }
}

fn position_of(session: &Session, cell_id: i32) -> Option<Position> {
    session
        .my_team
        .iter()
        .chain(&session.their_team)
        .find(|player| player.cell_id == cell_id)
        .and_then(|player| parse_position(&player.assigned_position))
}

fn parse_position(value: &str) -> Option<Position> {
    match value.to_ascii_lowercase().as_str() {
        "top" => Some(Position::Top),
        "jungle" => Some(Position::Jungle),
        "middle" => Some(Position::Mid),
        "bottom" => Some(Position::Adc),
        "utility" => Some(Position::Support),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use serde_json::{json, Value};

    use super::*;

    fn session(value: Value) -> Session {
        serde_json::from_value(value).expect("テスト用の JSON は読めるはず")
    }

    fn action(cell: i32, kind: &str, champion: i32, completed: bool) -> Value {
        json!({ "actorCellId": cell, "championId": champion, "completed": completed, "type": kind })
    }

    fn team(positions: [&str; 5], first_cell: i32) -> Value {
        Value::Array(
            positions
                .iter()
                .enumerate()
                .map(|(i, p)| json!({ "cellId": first_cell + i as i32, "assignedPosition": p }))
                .collect(),
        )
    }

    /// ランク戦: 10 人同時の BAN グループと、1 手ずつのピック
    fn ranked_session() -> Session {
        let bans: Vec<Value> = (0..10)
            .map(|cell| action(cell, "ban", if cell == 4 { 0 } else { 100 + cell }, true))
            .collect();
        session(json!({
            "localPlayerCellId": 6,
            "timer": { "phase": "BAN_PICK" },
            "myTeam": team(["top", "jungle", "middle", "bottom", "utility"], 5),
            "theirTeam": team(["", "", "", "", ""], 0),
            "actions": [
                bans,
                [action(0, "pick", 11, true)],
                [action(5, "pick", 22, true)],
                [action(6, "pick", 33, false)],
                [action(1, "pick", 0, false)],
            ]
        }))
    }

    #[test]
    fn ランク戦は_bans_が10手同時のグループとして読める() {
        let snapshot = ChampSelectSnapshot::from_session(&ranked_session()).unwrap();
        assert_eq!(snapshot.format, DraftFormat::Ranked);
        assert_eq!(snapshot.bans.len(), 10);
        assert_eq!(snapshot.phase, "BAN_PICK");
    }

    #[test]
    fn ban_なしの手は_champion_key_が_none() {
        let snapshot = ChampSelectSnapshot::from_session(&ranked_session()).unwrap();
        assert_eq!(snapshot.bans[4].champion_key, None);
        assert_eq!(snapshot.bans[3].champion_key, Some(103));
        assert_eq!(snapshot.bans[3].side, Side::Blue);
        assert_eq!(snapshot.bans[7].side, Side::Red);
    }

    #[test]
    fn 自分のサイドとロールを取り出す() {
        let snapshot = ChampSelectSnapshot::from_session(&ranked_session()).unwrap();
        assert_eq!(snapshot.my_side, Side::Red);
        // セル 6 は myTeam の 2 番目(jungle)
        assert_eq!(snapshot.my_position, Some(Position::Jungle));
    }

    #[test]
    fn 確定したピックだけ_champion_key_が入る() {
        let snapshot = ChampSelectSnapshot::from_session(&ranked_session()).unwrap();
        let keys: Vec<_> = snapshot.picks.iter().map(|p| p.champion_key).collect();
        // 3 手目は選択中(ホバー)、4 手目は未選択
        assert_eq!(keys, [Some(11), Some(22), None, None]);
    }

    #[test]
    fn ピックのロールは味方だけ分かる() {
        let snapshot = ChampSelectSnapshot::from_session(&ranked_session()).unwrap();
        assert_eq!(snapshot.picks[0].side, Side::Blue);
        assert_eq!(snapshot.picks[0].position, None); // 相手のロールは不明
        assert_eq!(snapshot.picks[1].side, Side::Red);
        assert_eq!(snapshot.picks[1].position, Some(Position::Top));
    }

    #[test]
    fn 大会形式は_ban_が1手ずつのグループ() {
        let session = session(json!({
            "localPlayerCellId": 0,
            "myTeam": team(["top", "jungle", "middle", "bottom", "utility"], 0),
            "actions": [
                [action(0, "ban", 1, true)],
                [action(5, "ban", 2, true)],
                [action(1, "pick", 3, true)],
            ]
        }));
        let snapshot = ChampSelectSnapshot::from_session(&session).unwrap();
        assert_eq!(snapshot.format, DraftFormat::Tournament);
        assert_eq!(snapshot.my_side, Side::Blue);
    }

    #[test]
    fn 演出用の手は無視する() {
        let session = session(json!({
            "localPlayerCellId": 0,
            "actions": [
                [action(0, "ban", 1, true), action(1, "ban", 2, true)],
                [json!({ "actorCellId": -1, "championId": 0, "completed": true, "type": "ten_bans_reveal" })],
            ]
        }));
        let snapshot = ChampSelectSnapshot::from_session(&session).unwrap();
        assert_eq!(snapshot.bans.len(), 2);
        assert!(snapshot.picks.is_empty());
    }

    #[test]
    fn 観戦中は対象外() {
        let session = session(json!({
            "localPlayerCellId": -1,
            "actions": [[action(0, "ban", 1, true)]]
        }));
        assert_eq!(
            ChampSelectSnapshot::from_session(&session),
            Err(Unsupported::Spectator)
        );
    }

    #[test]
    fn ban_のないモードは対象外() {
        let session = session(json!({
            "localPlayerCellId": 0,
            "actions": [[action(0, "pick", 1, true), action(1, "pick", 2, true)]]
        }));
        assert_eq!(
            ChampSelectSnapshot::from_session(&session),
            Err(Unsupported::NoBans)
        );
    }

    #[test]
    fn ロールの割り当てがなければ_none() {
        let session = session(json!({
            "localPlayerCellId": 2,
            "myTeam": team(["", "", "", "", ""], 0),
            "actions": [[action(0, "ban", 1, true), action(1, "ban", 2, true)]]
        }));
        let snapshot = ChampSelectSnapshot::from_session(&session).unwrap();
        assert_eq!(snapshot.my_position, None);
    }

    #[test]
    fn 画面に渡す_json_はキャメルケース() {
        let snapshot = ChampSelectSnapshot::from_session(&ranked_session()).unwrap();
        let value = serde_json::to_value(&snapshot).unwrap();
        assert_eq!(value["mySide"], "red");
        assert_eq!(value["myPosition"], "jungle");
        assert_eq!(value["format"], "ranked");
        assert_eq!(value["bans"][3]["championKey"], 103);
        assert_eq!(value["picks"][1]["position"], "top");
    }
}
