import { Skeleton } from "@/components/ui/skeleton";

export function ChampionGridSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <Skeleton className="h-8 w-full max-w-sm" />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-2">
        {Array.from({ length: 24 }, (_, index) => (
          <div key={index} className="flex flex-col items-center gap-1 p-1">
            <Skeleton className="size-12" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}
