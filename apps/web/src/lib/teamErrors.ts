import { ApiError } from "@/services/http";
import ja from "@/messages/ja.json";

const MESSAGES: Readonly<Record<string, string>> = ja.teams.errors;

/** API のエラーを、画面に出す文言にする */
export function teamErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return ja.teams.errors.unknown;
  if (error.status === 401) return ja.teams.errors.unauthorized;
  return MESSAGES[error.code] ?? ja.teams.errors.unknown;
}
