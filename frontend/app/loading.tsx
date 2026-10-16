import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-12 pt-4">
      <Skeleton className="h-[320px] w-full rounded-3xl sm:h-[380px]" />
      <div className="space-y-4">
        <Skeleton className="h-5 w-44 rounded-md" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="space-y-2.5">
              <Skeleton className="aspect-[2/3] w-full rounded-2xl" />
              <Skeleton className="h-3.5 w-4/5 rounded-md" />
              <Skeleton className="h-3 w-2/5 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
