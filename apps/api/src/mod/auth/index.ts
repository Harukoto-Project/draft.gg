import { account, session, user, verification } from "@draftgg/db";
import type { Database } from "@draftgg/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import type { SessionUser } from "@draftgg/shared";

import type { AuthConfig } from "../config/index.js";

/**
 * ルートとミドルウェアが使う認証の窓口。
 * Better Auth 本体を直接触らせず、テストでは差し替えられるようにする。
 */
export interface AuthGateway {
  /** `/api/auth/*` のリクエストを Better Auth に渡す */
  handler(request: Request): Promise<Response>;
  /** Cookie からログイン中のユーザーを返す。未ログインなら null */
  getUser(headers: Headers): Promise<SessionUser | null>;
}

/** 認証系エンドポイントの回数制限(1分あたり) */
const AUTH_RATE_LIMIT_MAX = 30;
const AUTH_RATE_LIMIT_WINDOW_SECONDS = 60;

export function createAuthGateway(db: Database, config: AuthConfig): AuthGateway {
  const auth = betterAuth({
    appName: "draft.gg",
    baseURL: config.baseUrl,
    basePath: "/api/auth",
    secret: config.secret,
    trustedOrigins: [config.baseUrl],
    database: drizzleAdapter(db, {
      provider: "mysql",
      schema: { user, session, account, verification },
    }),
    // ログインにしか使わないが、DB が漏れたときのために Discord のトークンは暗号化して保存する
    account: { encryptOAuthTokens: true },
    socialProviders: {
      discord: {
        clientId: config.discordClientId,
        clientSecret: config.discordClientSecret,
      },
    },
    rateLimit: {
      enabled: true,
      window: AUTH_RATE_LIMIT_WINDOW_SECONDS,
      max: AUTH_RATE_LIMIT_MAX,
    },
    advanced: {
      // cloudflared 経由でしか届かないので、接続元 IP は Cloudflare のヘッダーから読む
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
    },
  });

  return {
    handler: (request) => auth.handler(request),
    getUser: async (headers) => {
      const result = await auth.api.getSession({ headers });
      if (!result) return null;
      return {
        id: result.user.id,
        name: result.user.name,
        image: result.user.image ?? null,
      };
    },
  };
}
