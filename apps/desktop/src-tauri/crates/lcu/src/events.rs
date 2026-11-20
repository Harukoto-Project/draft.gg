//! LCU の WebSocket(WAMP 形式)のメッセージのうち、チャンピオンセレクトのセッションの更新だけを読む。
//! 購読の送信: `[5, "OnJsonApiEvent_lol-champ-select_v1_session"]`
//! 受信: `[8, "OnJsonApiEvent_lol-champ-select_v1_session", { "eventType": "Update", "uri": "...", "data": {...} }]`

use serde_json::Value;

use crate::session::Session;

pub const SESSION_URI: &str = "/lol-champ-select/v1/session";

/// WAMP の SUBSCRIBE(5) メッセージ
pub const SUBSCRIBE_SESSION: &str = r#"[5,"OnJsonApiEvent_lol-champ-select_v1_session"]"#;

const EVENT_OPCODE: i64 = 8;

#[derive(Debug)]
pub enum SessionEvent {
    /// セッションの作成・更新
    Update(Box<Session>),
    /// セッションの終了(ゲーム開始・ドッジ・キャンセル)
    Deleted,
}

/// 対象外のメッセージや、読めない形のメッセージは `None`
pub fn parse_session_event(text: &str) -> Option<SessionEvent> {
    let message: Value = serde_json::from_str(text).ok()?;
    let parts = message.as_array()?;
    if parts.first()?.as_i64()? != EVENT_OPCODE {
        return None;
    }
    let payload = parts.get(2)?;
    if payload.get("uri")?.as_str()? != SESSION_URI {
        return None;
    }
    if payload.get("eventType")?.as_str()? == "Delete" {
        return Some(SessionEvent::Deleted);
    }
    let session = serde_json::from_value(payload.get("data")?.clone()).ok()?;
    Some(SessionEvent::Update(Box::new(session)))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn event(event_type: &str, uri: &str, data: &str) -> String {
        format!(
            r#"[8,"OnJsonApiEvent_lol-champ-select_v1_session",{{"data":{data},"eventType":"{event_type}","uri":"{uri}"}}]"#
        )
    }

    #[test]
    fn 更新イベントからセッションを読む() {
        let text = event("Update", SESSION_URI, r#"{"localPlayerCellId":3}"#);
        match parse_session_event(&text) {
            Some(SessionEvent::Update(session)) => assert_eq!(session.local_player_cell_id, 3),
            other => panic!("Update のはず: {other:?}"),
        }
    }

    #[test]
    fn 作成イベントも更新として扱う() {
        let text = event("Create", SESSION_URI, r#"{"localPlayerCellId":0}"#);
        assert!(matches!(
            parse_session_event(&text),
            Some(SessionEvent::Update(_))
        ));
    }

    #[test]
    fn 削除イベントは_deleted() {
        let text = event("Delete", SESSION_URI, "null");
        assert!(matches!(
            parse_session_event(&text),
            Some(SessionEvent::Deleted)
        ));
    }

    #[test]
    fn 別の_uri_のイベントは無視する() {
        let text = event("Update", "/lol-gameflow/v1/session", "{}");
        assert!(parse_session_event(&text).is_none());
    }

    #[test]
    fn イベント以外のメッセージや壊れた_json_は無視する() {
        assert!(parse_session_event(r#"[0,"welcome"]"#).is_none());
        assert!(parse_session_event("not json").is_none());
        assert!(parse_session_event("{}").is_none());
        assert!(parse_session_event("[]").is_none());
    }
}
