// 定期バッチの常駐プロセス。スケジューラとジョブは mod/ に追加していく。
console.log(JSON.stringify({ level: "info", msg: "worker started" }));

// ジョブ登録(スケジューラ)を実装するまで、プロセスを常駐させるための待機。
const keepAlive = setInterval(() => {}, 1 << 30);

function shutdown(signal: string): void {
  console.log(JSON.stringify({ level: "info", msg: "worker stopping", signal }));
  clearInterval(keepAlive);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
