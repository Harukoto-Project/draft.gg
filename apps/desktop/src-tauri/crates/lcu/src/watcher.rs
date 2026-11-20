//! LoL クライアントを見張り、状態が変わるたびにコールバックで知らせる。
//! クライアントが起動していなければ一定間隔で探し、切断されたら探し直す。

use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use tokio_tungstenite::tungstenite::Message;

use crate::connection::{connect_events, fetch_session};
use crate::credentials::{find_running, Credentials};
use crate::error::LcuError;
use crate::events::{parse_session_event, SessionEvent, SUBSCRIBE_SESSION};
use crate::state::LcuState;

/// クライアントが見つからない・切断されたときに、再び探すまでの間隔
const RETRY_INTERVAL: Duration = Duration::from_secs(3);

/// 同じ状態が続けて届いても、コールバックは変化したときだけ呼ぶ
struct Emitter<F: FnMut(LcuState)> {
    on_state: F,
    last: Option<LcuState>,
}

impl<F: FnMut(LcuState)> Emitter<F> {
    fn emit(&mut self, state: LcuState) {
        if self.last.as_ref() == Some(&state) {
            return;
        }
        self.last = Some(state.clone());
        (self.on_state)(state);
    }
}

/// 終わらないループ。アプリの起動中、バックグラウンドのタスクとして動かす
pub async fn run<F: FnMut(LcuState)>(on_state: F) {
    let mut emitter = Emitter {
        on_state,
        last: None,
    };

    loop {
        let credentials = tokio::task::spawn_blocking(find_running)
            .await
            .ok()
            .flatten();
        if let Some(credentials) = credentials {
            if let Err(error) = watch(&credentials, &mut emitter).await {
                eprintln!("LoL クライアントとの接続が切れました: {error}");
            }
        }
        emitter.emit(LcuState::Disconnected);
        tokio::time::sleep(RETRY_INTERVAL).await;
    }
}

/// 1 回の接続の間、イベントを読み続ける。切断やエラーで戻る
async fn watch<F: FnMut(LcuState)>(
    credentials: &Credentials,
    emitter: &mut Emitter<F>,
) -> Result<(), LcuError> {
    let mut socket = connect_events(credentials).await?;
    // 購読してから現在の状態を取り、取り逃しを防ぐ(間に届いたイベントは、あとで順に処理する)
    socket.send(Message::text(SUBSCRIBE_SESSION)).await?;
    let current = fetch_session(credentials).await?;
    emitter.emit(match current {
        Some(session) => LcuState::from_session(&session),
        None => LcuState::Idle,
    });

    while let Some(message) = socket.next().await {
        match message? {
            Message::Text(text) => match parse_session_event(text.as_str()) {
                Some(SessionEvent::Update(session)) => {
                    emitter.emit(LcuState::from_session(&session));
                }
                Some(SessionEvent::Deleted) => emitter.emit(LcuState::Idle),
                None => {}
            },
            Message::Close(_) => break,
            _ => {}
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn 同じ状態は続けて通知しない() {
        let mut received = Vec::new();
        let mut emitter = Emitter {
            on_state: |state| received.push(state),
            last: None,
        };
        emitter.emit(LcuState::Idle);
        emitter.emit(LcuState::Idle);
        emitter.emit(LcuState::Disconnected);
        emitter.emit(LcuState::Idle);
        drop(emitter);
        assert_eq!(
            received,
            [LcuState::Idle, LcuState::Disconnected, LcuState::Idle]
        );
    }
}
