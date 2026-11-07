import { ChampionGridSkeleton } from "@/components/champion/ChampionGridSkeleton";
import { Skeleton } from "@/components/ui/skeleton";

export function DraftScreenSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-3 px-4 py-3">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-[16rem_minmax(0,1fr)_16rem]">
        <SideSkeleton />
        <div className="rounded-md bg-card p-3">
          <ChampionGridSkeleton />
        </div>
        <SideSkeleton />
      </div>
    </div>
  );
}

function SideSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-md border-l-4 border-side-blue bg-card p-3">
      <Skeleton className="h-5 w-16" />
      <div className="grid grid-cols-5 gap-1">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="aspect-square w-full" />
        ))}
      </div>
      {Array.from({ length: 3 }, (_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  );
}
