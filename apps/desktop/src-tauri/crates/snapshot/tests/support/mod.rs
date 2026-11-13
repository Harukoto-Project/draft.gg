//! テスト用の小さな HTTP サーバー。用意した応答を順に返し、届いたリクエストのヘッダーを記録する。

// テストファイルごとに別々にコンパイルされ、使わない関数が出る
#![allow(dead_code)]

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

#[derive(Clone)]
pub struct Reply {
    pub status: u16,
    pub headers: Vec<(String, String)>,
    pub body: String,
}

impl Reply {
    pub fn ok(body: &str, etag: &str) -> Self {
        Reply {
            status: 200,
            headers: vec![("ETag".into(), etag.into())],
            body: body.into(),
        }
    }

    pub fn status(status: u16) -> Self {
        Reply {
            status,
            headers: Vec::new(),
            body: String::new(),
        }
    }
}

/// 届いたリクエストのヘッダー(名前は小文字)
pub type RecordedRequest = HashMap<String, String>;

pub struct MockServer {
    pub base_url: String,
    requests: Arc<Mutex<Vec<RecordedRequest>>>,
}

impl MockServer {
    /// `replies` を届いた順に返す。使い切ったあとは 500 を返す
    pub async fn start(replies: Vec<Reply>) -> Self {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let base_url = format!("http://{}", listener.local_addr().unwrap());
        let requests = Arc::new(Mutex::new(Vec::new()));
        let queue = Arc::new(Mutex::new(
            replies
                .into_iter()
                .collect::<std::collections::VecDeque<_>>(),
        ));

        let recorded = requests.clone();
        tokio::spawn(async move {
            loop {
                let Ok((mut socket, _)) = listener.accept().await else {
                    return;
                };
                let recorded = recorded.clone();
                let queue = queue.clone();
                tokio::spawn(async move {
                    let mut buffer = Vec::new();
                    let mut chunk = [0u8; 1024];
                    while !buffer.windows(4).any(|window| window == b"\r\n\r\n") {
                        match socket.read(&mut chunk).await {
                            Ok(0) | Err(_) => return,
                            Ok(read) => buffer.extend_from_slice(&chunk[..read]),
                        }
                    }
                    let text = String::from_utf8_lossy(&buffer).to_string();
                    let headers: RecordedRequest = text
                        .lines()
                        .skip(1)
                        .filter_map(|line| line.split_once(':'))
                        .map(|(name, value)| (name.trim().to_lowercase(), value.trim().to_string()))
                        .collect();
                    recorded.lock().unwrap().push(headers);

                    let reply = queue
                        .lock()
                        .unwrap()
                        .pop_front()
                        .unwrap_or(Reply::status(500));
                    let mut response = format!(
                        "HTTP/1.1 {} X\r\nContent-Length: {}\r\nConnection: close\r\n",
                        reply.status,
                        reply.body.len()
                    );
                    for (name, value) in &reply.headers {
                        response.push_str(&format!("{name}: {value}\r\n"));
                    }
                    response.push_str("\r\n");
                    response.push_str(&reply.body);
                    let _ = socket.write_all(response.as_bytes()).await;
                    let _ = socket.shutdown().await;
                });
            }
        });

        MockServer { base_url, requests }
    }

    pub fn requests(&self) -> Vec<RecordedRequest> {
        self.requests.lock().unwrap().clone()
    }
}

pub fn snapshot_body(patch: &str) -> String {
    format!(
        r#"{{"patch":"{patch}","tier":"diamond_plus","champions":[],"meta":[],"matchups":[],"synergies":[],"pro":[]}}"#
    )
}
