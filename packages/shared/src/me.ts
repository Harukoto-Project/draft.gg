import { z } from "zod";

/** 画面に出すログイン中のユーザー */
export const sessionUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  image: z.string().nullable(),
});

export type SessionUser = z.infer<typeof sessionUserSchema>;

/** `GET /api/me` の応答。未ログインなら user が null */
export const meResponseSchema = z.object({
  /** false のときはログイン機能が未設定(ログイン導線を出さない) */
  loginEnabled: z.boolean(),
  user: sessionUserSchema.nullable(),
});

export type MeResponse = z.infer<typeof meResponseSchema>;
