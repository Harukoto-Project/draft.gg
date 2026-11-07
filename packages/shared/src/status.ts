import { z } from "zod";

/** 更新状況として見せるバッチ。画面に出すものだけを並べる */
export const STATUS_JOBS = ["ddragon", "opgg-meta", "opgg-champion", "pro-aggregate"] as const;

export type StatusJob = (typeof STATUS_JOBS)[number];

export const statusResponseSchema = z.object({
  /** 現在のパッチ。未取り込みなら null */
  patch: z.string().nullable(),
  /** ジョブごとの、最後に成功した時刻(ISO 8601)。まだ成功していなければ null */
  updatedAt: z.object({
    ddragon: z.string().nullable(),
    "opgg-meta": z.string().nullable(),
    "opgg-champion": z.string().nullable(),
    "pro-aggregate": z.string().nullable(),
  }),
});

export type StatusResponse = z.infer<typeof statusResponseSchema>;
