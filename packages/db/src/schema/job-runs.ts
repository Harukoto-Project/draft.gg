import {
  bigint,
  datetime,
  index,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  varchar,
} from "drizzle-orm/mysql-core";

export const JOB_RUN_STATUSES = ["running", "success", "failed"] as const;

export type JobRunStatus = (typeof JOB_RUN_STATUSES)[number];

export const jobRuns = mysqlTable(
  "job_runs",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    job: varchar("job", { length: 64 }).notNull(),
    status: mysqlEnum("status", JOB_RUN_STATUSES).notNull(),
    startedAt: datetime("started_at", { fsp: 3 }).notNull(),
    finishedAt: datetime("finished_at", { fsp: 3 }),
    summary: json("summary").$type<Record<string, unknown>>(),
    error: text("error"),
  },
  (table) => [index("job_runs_job_started_at_idx").on(table.job, table.startedAt)],
);
