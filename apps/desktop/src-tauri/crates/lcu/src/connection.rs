//! LCU への接続。常に `127.0.0.1` だけに繋ぐ。
//! LCU は Riot の自己署名証明書で応答するので、この接続に限って証明書の検証を切る。
//! 認証は Basic(ユーザー名 `riot`、パスワードは認証トークン)。

use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use reqwest::StatusCode;
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::tungstenite::http::header::AUTHORIZATION;
use tokio_tungstenite::tungstenite::http::HeaderValue;
use tokio_tungstenite::{Connector, MaybeTlsStream, WebSocketStream};

use crate::credentials::Credentials;
use crate::error::LcuError;
use crate::events::SESSION_URI;
use crate::session::Session;

pub type EventSocket = WebSocketStream<MaybeTlsStream<tokio::net::TcpStream>>;

const HOST: &str = "127.0.0.1";

fn authorization(credentials: &Credentials) -> Result<HeaderValue, LcuError> {
    let encoded = STANDARD.encode(format!("riot:{}", credentials.token));
    let mut value = HeaderValue::from_str(&format!("Basic {encoded}"))
        .map_err(|_| LcuError::Invalid("認証ヘッダーを作れませんでした".into()))?;
    value.set_sensitive(true);
    Ok(value)
}

/// いまのチャンピオンセレクトのセッション。チャンピオンセレクト中でなければ `None`
pub async fn fetch_session(credentials: &Credentials) -> Result<Option<Session>, LcuError> {
    let client = reqwest::Client::builder()
        .use_native_tls()
        .danger_accept_invalid_certs(true)
        .timeout(std::time::Duration::from_secs(5))
        .build()?;
    let response = client
        .get(format!("https://{HOST}:{}{SESSION_URI}", credentials.port))
        .header(AUTHORIZATION, authorization(credentials)?)
        .send()
        .await?;

    match response.status() {
        // チャンピオンセレクト中でないときは 404
        StatusCode::NOT_FOUND => Ok(None),
        StatusCode::OK => {
            let body = response.bytes().await?;
            let session = serde_json::from_slice(&body)
                .map_err(|error| LcuError::Invalid(error.to_string()))?;
            Ok(Some(session))
        }
        status => Err(LcuError::Status(status.as_u16())),
    }
}

/// イベント用の WebSocket に接続する。購読は呼び出し側が送る
pub async fn connect_events(credentials: &Credentials) -> Result<EventSocket, LcuError> {
    let mut request = format!("wss://{HOST}:{}/", credentials.port)
        .into_client_request()
        .map_err(LcuError::Socket)?;
    request
        .headers_mut()
        .insert(AUTHORIZATION, authorization(credentials)?);

    let tls = native_tls::TlsConnector::builder()
        .danger_accept_invalid_certs(true)
        .build()?;
    let (socket, _) = tokio_tungstenite::connect_async_tls_with_config(
        request,
        None,
        false,
        Some(Connector::NativeTls(tls)),
    )
    .await?;
    Ok(socket)
}
