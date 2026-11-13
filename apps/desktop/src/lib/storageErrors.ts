/** Rust のコードのうち、画面の文言のキー名が違うもの */
const CODE_ALIASES: Readonly<Record<string, string>> = { invalid_input: "invalid_request" };

/**
 * ローカル保存のエラー(Rust が返すコード)を、画面に出す文言にする。
 * `limit_reached` だけは機能ごとに文言が違うので、`limitKey` で選ぶ
 */
export function storageErrorMessage(
  error: unknown,
  messages: Readonly<Record<string, string>>,
  limitKey: string,
): string {
  const unknown = messages.unknown ?? "";
  if (!(error instanceof Error)) return unknown;
  const key =
    error.message === "limit_reached" ? limitKey : (CODE_ALIASES[error.message] ?? error.message);
  return messages[key] ?? unknown;
}
