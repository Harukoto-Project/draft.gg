import { ApiError } from "@/services/http";
import ja from "@/messages/ja.json";

const MESSAGES: Readonly<Record<string, string>> = ja.drafts.errors;

/** API のエラーを、画面に出す文言にする */
export function draftErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return ja.drafts.errors.unknown;
  if (error.status === 401) return ja.drafts.errors.unauthorized;
  return MESSAGES[error.code] ?? ja.drafts.errors.unknown;
}
