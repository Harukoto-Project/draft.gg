import { ApiError } from "@/services/http";
import { formatMessage } from "@/lib/formatMessage";
import ja from "@/messages/ja.json";

const MESSAGES: Readonly<Record<string, string>> = ja.profiles.errors;

/** API のエラーを、画面に出す文言にする。待ち時間があれば分に直して添える */
export function profileErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return ja.profiles.errors.unknown;
  if (error.status === 401) return ja.profiles.errors.unauthorized;
  const message = MESSAGES[error.code] ?? ja.profiles.errors.unknown;
  if (error.retryAfterSeconds === null) return message;
  return `${message}${formatMessage(ja.profiles.errors.retryAfter, {
    minutes: String(Math.max(1, Math.ceil(error.retryAfterSeconds / 60))),
  })}`;
}
