import { STATUS_JOBS } from "@draftgg/shared";
import type { StatusResponse } from "@draftgg/shared";

const DATE_FORMAT = new Intl.DateTimeFormat("ja-JP", {
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatUpdatedAt(iso: string): string {
  return DATE_FORMAT.format(new Date(iso));
}

/** どれかのデータが最後に更新された時刻(ISO)。まだ何も更新されていなければ null */
export function latestUpdate(status: StatusResponse): string | null {
  let latest: string | null = null;
  for (const job of STATUS_JOBS) {
    const value = status.updatedAt[job];
    if (value && (latest === null || new Date(value) > new Date(latest))) latest = value;
  }
  return latest;
}
