import { Skeleton } from '@/components/ui';

/** Skeleton saat rute lazy dimuat. */
export function RouteFallback() {
  return (
    <div className="flex flex-col gap-3 p-4 lg:p-8" aria-busy="true" aria-label="Memuat">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-36" />
      <Skeleton className="h-16" />
      <Skeleton className="h-16" />
    </div>
  );
}
