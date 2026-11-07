"use client";

import { STATUS_JOBS } from "@draftgg/shared";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useStatus } from "@/hooks/use-status";
import ja from "@/messages/ja.json";

const DATE_FORMAT = new Intl.DateTimeFormat("ja-JP", {
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** パッチと、各データを最後に更新した時刻 */
export function StatusPanel() {
  const status = useStatus();

  if (status.isPending) {
    return (
      <div className="flex flex-col gap-2" aria-hidden="true">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-5 w-64" />
        ))}
      </div>
    );
  }
  if (!status.data) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-foreground">{ja.home.statusLoadError}</p>
        <Button variant="outline" size="sm" onClick={() => void status.refetch()}>
          {ja.home.statusRetry}
        </Button>
      </div>
    );
  }

  const { patch, updatedAt } = status.data;
  return (
    <dl className="grid max-w-md grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 text-sm">
      <dt className="text-muted-foreground">{ja.home.patch}</dt>
      <dd className="text-right tabular-nums text-foreground">{patch ?? ja.home.patchUnknown}</dd>
      {STATUS_JOBS.map((job) => {
        const value = updatedAt[job];
        return (
          <div key={job} className="col-span-2 grid grid-cols-subgrid">
            <dt className="text-muted-foreground">{ja.home.jobs[job]}</dt>
            <dd className="text-right tabular-nums text-foreground">
              {value ? (
                <time dateTime={value}>{DATE_FORMAT.format(new Date(value))}</time>
              ) : (
                ja.home.notUpdated
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
