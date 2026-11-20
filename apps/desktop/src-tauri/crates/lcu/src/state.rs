//! 画面に渡す、LoL クライアントの状態。

use serde::Serialize;

use crate::champ_select::ChampSelectSnapshot;
use crate::session::Session;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "status", rename_all = "camelCase")]
pub enum LcuState {
    /// クライアントが起動していない、または接続できない
    Disconnected,
    /// 接続済みで、チャンピオンセレクト中ではない
    Idle,
    /// チャンピオンセレクト中だが、ドラフトとして扱えない(観戦・ブラインドピックなど)
    Unsupported,
    /// ドラフト形式のチャンピオンセレクト中
    #[serde(rename_all = "camelCase")]
    ChampSelect { snapshot: ChampSelectSnapshot },
}

impl LcuState {
    pub fn from_session(session: &Session) -> Self {
        match ChampSelectSnapshot::from_session(session) {
            Ok(snapshot) => Self::ChampSelect { snapshot },
            Err(_) => Self::Unsupported,
        }
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    #[test]
    fn 状態は_status_で区別できる_json_になる() {
        assert_eq!(
            serde_json::to_value(LcuState::Disconnected).unwrap(),
            json!({ "status": "disconnected" })
        );
        assert_eq!(
            serde_json::to_value(LcuState::Idle).unwrap(),
            json!({ "status": "idle" })
        );
        assert_eq!(
            serde_json::to_value(LcuState::Unsupported).unwrap(),
            json!({ "status": "unsupported" })
        );
    }

    #[test]
    fn ドラフトのセッションは_champ_select_になる() {
        let session: Session = serde_json::from_value(json!({
            "localPlayerCellId": 0,
            "actions": [[
                { "actorCellId": 0, "championId": 1, "completed": true, "type": "ban" },
                { "actorCellId": 1, "championId": 2, "completed": true, "type": "ban" }
            ]]
        }))
        .unwrap();
        let value = serde_json::to_value(LcuState::from_session(&session)).unwrap();
        assert_eq!(value["status"], "champSelect");
        assert_eq!(value["snapshot"]["format"], "ranked");
    }

    #[test]
    fn ドラフトにならないセッションは_unsupported() {
        let session: Session = serde_json::from_value(json!({ "localPlayerCellId": -1 })).unwrap();
        assert_eq!(LcuState::from_session(&session), LcuState::Unsupported);
    }
}
