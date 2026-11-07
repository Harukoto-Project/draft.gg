# コントリビュートについて

IssueとPull Requestを歓迎します。

## 開発環境

- OS: 開発はWindowsで行っています。本番はLinux + systemdを想定しています(`deploy/`にユニットのひな形があります)
- 言語: TypeScript 7.x(`package.json`の`typescript`)、Node.js 24以上(`engines`)
- パッケージマネージャー: pnpm(`package.json`の`packageManager`に記載のバージョン)
- データベース: MySQL(`utf8mb4`で作成)。api / worker / マイグレーションを動かすときに必要です

セットアップの手順は[README](README.md)を参照してください。

## 提出前の確認

CIは使っていないため、次のコマンドをルートで実行してから提出してください。

- `pnpm typecheck`: 全パッケージの型チェック
- `pnpm lint`: Oxlintによる静的解析
- `pnpm format:check`: Oxfmtによる整形の確認(`pnpm format`で整形します)
- `pnpm test`: Vitestによる全パッケージのテスト
- `pnpm build`: 全パッケージのビルド

スキーマを変えたときは、`pnpm --filter @draftgg/db db:generate`でマイグレーションを生成し、`packages/db/drizzle/`の変更もコミットに含めてください。

## バグ報告

次の情報があると調査しやすくなります。

- 起きた画面(`/draft`、`/profiles`など)と、再現手順
- ドラフトの内容: 形式(ランク戦 / 大会)、自分の陣営、入力したBAN・ピック、提案の対象ロール
- 提案が想定と違うとき: 提案カードの理由と要素別スコア、`/settings`で重みを変えているか、トップ画面に出ているデータの更新状況と現在のパッチ
- ログインやプール同期のとき: Discordでログインしているか、Riot IDのリージョンと、表示されたエラーメッセージ(Riot IDそのものは伏せて構いません)
- ブラウザとOSの種類・バージョン
- 自分の環境で動かしているとき: コミットまたはバージョン、Node.js・pnpm・MySQLのバージョン
- 統計の取り込み(worker)の不具合: 失敗したジョブ名、時刻、JSON形式のログ、`job_runs`の`status`と`error`

ログや設定を貼るときは、トークン・パスワード・接続文字列などの秘密情報を必ず伏せてください。

## セキュリティ上の問題

セキュリティに関わる問題は公開Issueではなく、GitHubのSecurity Advisory(Report a vulnerability)から非公開で報告してください。

## ライセンス

コントリビュートされた内容は、本プロジェクトと同じApache License 2.0で提供されるものとします。
