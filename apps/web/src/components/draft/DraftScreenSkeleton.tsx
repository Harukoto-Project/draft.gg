import { ChampionGridSkeleton } from "@/components/champion/ChampionGridSkeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function DraftScreenSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-3 px-4 py-3">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-3 px-3 pb-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)]">
        <BansSkeleton className="lg:col-start-1 lg:row-start-1" />
        <Skeleton className="col-span-2 h-10 lg:col-span-1 lg:col-start-2 lg:row-start-1" />
        <BansSkeleton className="lg:col-start-3 lg:row-start-1" />
        <PicksSkeleton className="lg:col-start-1 lg:row-start-2" />
        <div className="col-span-2 bg-card p-3 lg:col-span-1 lg:col-start-2 lg:row-start-2">
          <ChampionGridSkeleton />
        </div>
        <PicksSkeleton className="lg:col-start-3 lg:row-start-2" />
      </div>
    </div>
  );
}

function BansSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2 bg-card p-3", className)}>
      <Skeleton className="h-5 w-16" />
      <div className="grid grid-cols-5 gap-1">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="aspect-square w-full" />
        ))}
      </div>
    </div>
  );
}

function PicksSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("hidden flex-col gap-2 bg-card p-3 lg:flex", className)}>
      {Array.from({ length: 5 }, (_, index) => (
        <Skeleton key={index} className="h-[4.5rem] w-full" />
      ))}
    </div>
  );
}
