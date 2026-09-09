import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function FactTile({
  icon,
  label,
  value,
  className,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5', className)}>
      <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-slate-800">{value}</div>
    </div>
  );
}
