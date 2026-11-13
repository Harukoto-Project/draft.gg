import { storageErrorMessage } from "@/lib/storageErrors";
import ja from "@/messages/ja.json";

/** ドラフトの保存エラーを、画面に出す文言にする */
export function draftErrorMessage(error: unknown): string {
  return storageErrorMessage(error, ja.drafts.errors, "draft_limit");
}
