import { cn } from '@/lib/utils';
import { sectionCardClass } from '@/components/uiStyles';

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-slate-100', className)} />;
}

export function PageSkeleton({ title = true }: { title?: boolean }) {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading">
      {title && (
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <SkeletonBlock className="h-6 w-48" />
            <SkeletonBlock className="h-3 w-72 max-w-full" />
          </div>
          <SkeletonBlock className="h-10 w-32" />
        </div>
      )}
      <CardGridSkeleton />
      <TableSkeleton />
    </div>
  );
}

export function CardGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true" aria-label="Loading cards">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className={sectionCardClass}>
          <SkeletonBlock className="h-3 w-24" />
          <SkeletonBlock className="mt-4 h-7 w-20" />
          <SkeletonBlock className="mt-3 h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-200/40" aria-busy="true" aria-label="Loading table">
      <div className="grid gap-3 bg-[var(--color-navy)] px-4 py-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {Array.from({ length: columns }).map((_, index) => (
          <SkeletonBlock key={index} className="h-3 bg-white/25" />
        ))}
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="grid gap-3 px-4 py-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
            {Array.from({ length: columns }).map((_, columnIndex) => (
              <SkeletonBlock key={columnIndex} className={cn('h-4', columnIndex === 0 && 'w-3/4', columnIndex === columns - 1 && 'w-1/2')} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function FormSkeleton({ sections = 2 }: { sections?: number }) {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading form">
      <div className={sectionCardClass}>
        <div className="flex items-center gap-4">
          <SkeletonBlock className="h-16 w-16 rounded-xl" />
          <div className="flex-1 space-y-2">
            <SkeletonBlock className="h-5 w-44" />
            <SkeletonBlock className="h-3 w-80 max-w-full" />
          </div>
          <SkeletonBlock className="h-8 w-24" />
        </div>
      </div>
      {Array.from({ length: sections }).map((_, index) => (
        <div key={index} className={sectionCardClass}>
          <div className="mb-4 flex items-center gap-2">
            <SkeletonBlock className="h-8 w-8" />
            <SkeletonBlock className="h-4 w-32" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((__, fieldIndex) => (
              <div key={fieldIndex} className="space-y-2">
                <SkeletonBlock className="h-3 w-20" />
                <SkeletonBlock className="h-10 w-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function InlineSkeleton({ className }: { className?: string }) {
  return <SkeletonBlock className={className} />;
}
