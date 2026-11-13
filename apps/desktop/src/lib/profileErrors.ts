import { storageErrorMessage } from "@/lib/storageErrors";
import ja from "@/messages/ja.json";

/** プレイヤー・プールの保存エラーを、画面に出す文言にする */
export function profileErrorMessage(error: unknown): string {
  return storageErrorMessage(error, ja.profiles.errors, "profile_limit");
}
