import type { ComplianceGrade } from '@clinic-care/shared-types';
import { cn } from '@/lib/utils';

const GRADE_STYLE: Record<ComplianceGrade, string> = {
  GOOD: 'bg-green-100 text-green-700',
  AVERAGE: 'bg-amber-100 text-amber-700',
  POOR: 'bg-red-100 text-red-700',
};

export function ComplianceBadge({ percent, grade }: { percent: number; grade: ComplianceGrade }) {
  return (
    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', GRADE_STYLE[grade])}>
      {percent}% compliance
    </span>
  );
}
