// 定期バッチの常駐プロセス。スケジューラとジョブは mod/ に追加していく。
console.log(JSON.stringify({ level: "info", msg: "worker started" }));

// ジョブ登録(スケジューラ)を実装するまで、プロセスを常駐させるための待機。
const keepAlive = setInterval(() => {}, 1 << 30);

// シグナルのリスナーを登録すると Node の既定の終了処理が外れるため、後片付けのあとに明示的に終了する。
function shutdown(signal: string): void {
  console.log(JSON.stringify({ level: "info", msg: "worker stopping", signal }));
  clearInterval(keepAlive);
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
