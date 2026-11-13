import { storageErrorMessage } from "@/lib/storageErrors";
import ja from "@/messages/ja.json";

/** チームの保存エラーを、画面に出す文言にする */
export function teamErrorMessage(error: unknown): string {
  return storageErrorMessage(error, ja.teams.errors, "team_limit");
}
