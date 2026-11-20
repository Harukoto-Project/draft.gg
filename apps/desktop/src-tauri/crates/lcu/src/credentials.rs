//! 起動中の LoL クライアントに接続するための資格情報(ポートと認証トークン)。
//! クライアントの `LeagueClientUx` プロセスのコマンドライン引数から取る。
//! lockfile の置き場所はインストール先で変わるが、引数ならどこにあっても同じ形で読める。
//! トークンはログに出さず、ディスクにも保存しない。

use std::fmt;

use sysinfo::{ProcessRefreshKind, ProcessesToUpdate, System, UpdateKind};

const PORT_FLAG: &str = "--app-port=";
const TOKEN_FLAG: &str = "--remoting-auth-token=";

#[derive(Clone, PartialEq, Eq)]
pub struct Credentials {
    pub port: u16,
    pub token: String,
}

// トークンを誤ってログに出さないよう、Debug では伏せる
impl fmt::Debug for Credentials {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Credentials")
            .field("port", &self.port)
            .field("token", &"<redacted>")
            .finish()
    }
}

impl Credentials {
    /// コマンドライン引数から取り出す。必要な引数が欠けていれば `None`
    pub fn from_args<S: AsRef<str>>(args: &[S]) -> Option<Self> {
        let mut port = None;
        let mut token = None;
        for arg in args {
            let arg = arg.as_ref().trim_matches('"');
            if let Some(value) = arg.strip_prefix(PORT_FLAG) {
                port = value.parse::<u16>().ok();
            } else if let Some(value) = arg.strip_prefix(TOKEN_FLAG) {
                if !value.is_empty() {
                    token = Some(value.to_string());
                }
            }
        }
        Some(Self {
            port: port?,
            token: token?,
        })
    }
}

/// UI プロセス名か。描画用の `LeagueClientUxRender` は引数を持たないので除く
fn is_client_ux(name: &str) -> bool {
    let name = name.strip_suffix(".exe").unwrap_or(name);
    name == "LeagueClientUx"
}

/// 起動中のクライアントから資格情報を探す。見つからなければ `None`。
/// プロセス一覧の走査は重いので、まず名前だけで探し、見つけたプロセスだけ引数を読む。
/// 管理者権限で動いているクライアントの引数は、通常権限のアプリからは読めない。
pub fn find_running() -> Option<Credentials> {
    let mut system = System::new().ok()?;
    system.refresh_processes_specifics(ProcessesToUpdate::All, true, ProcessRefreshKind::nothing());
    let pid = system
        .processes()
        .iter()
        .find(|(_, process)| is_client_ux(&process.name().to_string_lossy()))
        .map(|(pid, _)| *pid)?;

    system.refresh_processes_specifics(
        ProcessesToUpdate::Some(&[pid]),
        true,
        ProcessRefreshKind::nothing().with_cmd(UpdateKind::Always),
    );
    let args: Vec<String> = system
        .process(pid)?
        .cmd()
        .iter()
        .map(|arg| arg.to_string_lossy().into_owned())
        .collect();
    Credentials::from_args(&args)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn コマンドライン引数からポートとトークンを取り出す() {
        let args = [
            "C:/Riot Games/League of Legends/LeagueClientUx.exe",
            "--riotclient-auth-token=other",
            "--app-port=51234",
            "--remoting-auth-token=abc_DEF-123",
            "--locale=ja_JP",
        ];
        let credentials = Credentials::from_args(&args).expect("読めるはず");
        assert_eq!(credentials.port, 51234);
        assert_eq!(credentials.token, "abc_DEF-123");
    }

    #[test]
    fn 引数が引用符で囲まれていても読める() {
        let args = ["\"--app-port=2999\"", "\"--remoting-auth-token=tok\""];
        let credentials = Credentials::from_args(&args).expect("読めるはず");
        assert_eq!(credentials.port, 2999);
        assert_eq!(credentials.token, "tok");
    }

    #[test]
    fn 必要な引数が欠けていれば_none() {
        assert!(Credentials::from_args(&["--app-port=1"]).is_none());
        assert!(Credentials::from_args(&["--remoting-auth-token=t"]).is_none());
        assert!(Credentials::from_args(&["--app-port=x", "--remoting-auth-token=t"]).is_none());
        assert!(Credentials::from_args(&["--app-port=1", "--remoting-auth-token="]).is_none());
        assert!(Credentials::from_args::<&str>(&[]).is_none());
    }

    #[test]
    fn debug_出力にトークンを含めない() {
        let credentials = Credentials {
            port: 1,
            token: "secret-token".into(),
        };
        assert!(!format!("{credentials:?}").contains("secret-token"));
    }

    #[test]
    fn ux_プロセスだけを対象にする() {
        assert!(is_client_ux("LeagueClientUx.exe"));
        assert!(is_client_ux("LeagueClientUx"));
        assert!(!is_client_ux("LeagueClientUxRender.exe"));
        assert!(!is_client_ux("LeagueClient.exe"));
    }
}
