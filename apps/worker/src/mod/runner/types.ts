export interface Job {
  /** job_runs.job に記録する名前(1ジョブ = 1ファイルの名前と揃える) */
  name: string;
  /** cron 式(タイムゾーンは Asia/Tokyo)。null はスケジュールせず、他のジョブから起動する */
  schedule: string | null;
  /** worker の起動時にも1回実行するか */
  runOnStart: boolean;
  /** ランナーの最大試行回数を、このジョブだけ変える(1回が長く、外部への呼び出しが多いジョブ向け) */
  maxAttempts?: number;
  /**
   * 実行する。戻り値は job_runs.summary に記録される。
   * 長いジョブは signal を確認し、停止要求(signal.aborted)があれば保存せずに例外で戻ること。
   */
  run(signal?: AbortSignal): Promise<Record<string, unknown>>;
}

export interface JobRunStore {
  start(job: string, startedAt: Date): Promise<number>;
  finish(
    id: number,
    result: {
      status: "success" | "failed";
      finishedAt: Date;
      summary?: Record<string, unknown>;
      error?: string;
    },
  ): Promise<void>;
}
