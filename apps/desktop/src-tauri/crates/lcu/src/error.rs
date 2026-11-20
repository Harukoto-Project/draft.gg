use std::fmt;

/// LCU への接続・通信の失敗。資格情報は含めない
#[derive(Debug)]
pub enum LcuError {
    Tls(native_tls::Error),
    Http(reqwest::Error),
    Socket(tokio_tungstenite::tungstenite::Error),
    /// 想定外の HTTP ステータス(認証トークンの不一致など)
    Status(u16),
    /// 想定外の応答の形
    Invalid(String),
}

impl fmt::Display for LcuError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Tls(error) => write!(f, "TLS の設定に失敗しました: {error}"),
            Self::Http(error) => write!(f, "LCU への HTTP 通信に失敗しました: {error}"),
            Self::Socket(error) => write!(f, "LCU の WebSocket が失敗しました: {error}"),
            Self::Status(status) => write!(f, "LCU が想定外のステータスを返しました: {status}"),
            Self::Invalid(message) => write!(f, "LCU の応答を読めませんでした: {message}"),
        }
    }
}

impl std::error::Error for LcuError {}

impl From<native_tls::Error> for LcuError {
    fn from(error: native_tls::Error) -> Self {
        Self::Tls(error)
    }
}

impl From<reqwest::Error> for LcuError {
    fn from(error: reqwest::Error) -> Self {
        Self::Http(error)
    }
}

impl From<tokio_tungstenite::tungstenite::Error> for LcuError {
    fn from(error: tokio_tungstenite::tungstenite::Error) -> Self {
        Self::Socket(error)
    }
}
