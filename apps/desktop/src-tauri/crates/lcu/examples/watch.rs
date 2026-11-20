//! 実機の LoL クライアントを見張り、状態の変化を標準出力に出す動作確認用。
//! `cargo run -p draftgg-lcu --example watch`(Ctrl+C で終了)。認証トークンは出力しない。

#[tokio::main(flavor = "current_thread")]
async fn main() {
    draftgg_lcu::run(|state| {
        println!(
            "{}",
            serde_json::to_string(&state).expect("状態は JSON にできるはず")
        );
    })
    .await;
}
