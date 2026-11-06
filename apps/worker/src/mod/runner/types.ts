export interface Job {
  /** job_runs.job に記録する名前(1ジョブ = 1ファイルの名前と揃える) */
  name: string;
  /** cron 式(タイムゾーンは Asia/Tokyo) */
  schedule: string;
  /** worker の起動時にも1回実行するか */
  runOnStart: boolean;
  /** 実行する。戻り値は job_runs.summary に記録される */
  run(): Promise<Record<string, unknown>>;
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
