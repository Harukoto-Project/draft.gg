import { STATUS_JOBS } from "@draftgg/shared";
import type { StatusResponse } from "@draftgg/shared";

import { formatUpdatedAt } from "@/lib/status";
import ja from "@/messages/ja.json";

/** パッチと、各データを最後に更新した時刻の一覧 */
export function StatusList({ status }: { status: StatusResponse }) {
  const { patch, updatedAt } = status;
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 text-sm">
      <dt className="text-muted-foreground">{ja.status.patchLabel}</dt>
      <dd className="text-right tabular-nums text-foreground">{patch ?? ja.status.patchUnknown}</dd>
      {STATUS_JOBS.map((job) => {
        const value = updatedAt[job];
        return (
          <div key={job} className="col-span-2 grid grid-cols-subgrid">
            <dt className="text-muted-foreground">{ja.status.jobs[job]}</dt>
            <dd className="text-right tabular-nums text-foreground">
              {value ? (
                <time dateTime={value}>{formatUpdatedAt(value)}</time>
              ) : (
                ja.status.notUpdated
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
