import { meResponseSchema } from "@draftgg/shared";
import type { MeResponse } from "@draftgg/shared";

export async function loadMe(signal?: AbortSignal): Promise<MeResponse> {
  const response = await fetch("/api/me", { signal });
  if (!response.ok) {
    throw new Error("me_unavailable");
  }
  return meResponseSchema.parse(await response.json());
}

/** Discord の認可画面へ移動する。成功するとページ遷移するので戻らない */
export async function signInWithDiscord(callbackPath: string): Promise<void> {
  const response = await fetch("/api/auth/sign-in/social", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider: "discord", callbackURL: callbackPath }),
  });
  if (!response.ok) {
    throw new Error("sign_in_failed");
  }
  const body = (await response.json()) as { url?: unknown };
  if (typeof body.url !== "string") {
    throw new Error("sign_in_failed");
  }
  window.location.assign(body.url);
}

export async function signOut(): Promise<void> {
  const response = await fetch("/api/auth/sign-out", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  if (!response.ok) {
    throw new Error("sign_out_failed");
  }
}
