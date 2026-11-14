import { ChampionGridSkeleton } from "@/components/champion/ChampionGridSkeleton";
import { Skeleton } from "@/components/ui/skeleton";

export function DraftScreenSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-3 px-3 py-3">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-7 w-20" />
      </div>
      <div className="grid shrink-0 grid-cols-1 gap-2 px-3 md:grid-cols-2">
        <SideSkeleton />
        <SideSkeleton />
      </div>
      <div className="min-h-0 flex-1 p-3">
        <ChampionGridSkeleton />
      </div>
    </div>
  );
}

function SideSkeleton() {
  return (
    <div className="flex flex-col gap-2 rounded-xs border p-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-8 w-40" />
      </div>
      <div className="grid h-[clamp(7.5rem,24vh,12rem)] grid-cols-5 gap-2">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="size-full" />
        ))}
      </div>
    </div>
  );
}
