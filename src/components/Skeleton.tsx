export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-surface-2 rounded ${className ?? ""}`}
      aria-hidden
    />
  );
}

export function ListingCardSkeleton() {
  return (
    <article className="bg-surface border border-border rounded-xl overflow-hidden">
      <div className="flex p-3 gap-3">
        <Skeleton className="w-20 h-20 rounded-lg shrink-0" />
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <div className="flex items-center gap-2 mt-1">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 border-t border-border h-10">
        <Skeleton className="h-full rounded-none" />
        <Skeleton className="h-full rounded-none" />
      </div>
    </article>
  );
}
