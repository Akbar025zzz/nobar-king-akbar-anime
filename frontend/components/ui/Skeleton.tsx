export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`skeleton ${className}`} />;
}

export function PosterCardSkeleton() {
  return (
    <div className="flex flex-col gap-2.5">
      <Skeleton className="aspect-[2/3] w-full rounded-2xl" />
      <Skeleton className="h-3.5 w-4/5 rounded-md" />
      <Skeleton className="h-3 w-2/5 rounded-md" />
    </div>
  );
}

export function CardGridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {Array.from({ length: count }).map((_, index) => (
        <PosterCardSkeleton key={index} />
      ))}
    </div>
  );
}

export function RowSkeleton({ title }: { title: string }) {
  return (
    <section className="space-y-4">
      <div className="section-heading">
        <h2 className="section-title text-fog-200">{title}</h2>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <PosterCardSkeleton key={index} />
        ))}
      </div>
    </section>
  );
}
