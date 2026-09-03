import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';
import type { Counter } from '@clinic-care/shared-types';
import { useCounterMutations, useCountersQuery } from '@/hooks/useCounters';
import { useAuthStore } from '@/store/auth-store';
import { hasPermission } from '@/lib/permissions';
import { getErrorMessage } from '@/lib/utils';
import { CardGridSkeleton } from '@/components/Skeleton';

const COUNTER_LABELS: Record<string, string> = {
  PATIENT: 'Patient ID',
  VISIT: 'Visit Number',
  BILL: 'Bill Number',
  CERTIFICATE: 'Certificate Number',
};

function CounterRow({ counter, canEdit }: { counter: Counter; canEdit: boolean }) {
  const { update } = useCounterMutations();
  const [prefix, setPrefix] = useState(counter.prefix);
  const [currentValue, setCurrentValue] = useState(counter.currentValue);

  useEffect(() => {
    setPrefix(counter.prefix);
    setCurrentValue(counter.currentValue);
  }, [counter.prefix, counter.currentValue]);

  const dirty = prefix !== counter.prefix || currentValue !== counter.currentValue;
  const lowered = currentValue < counter.currentValue;

  const onSave = async () => {
    try {
      await update.mutateAsync({ key: counter.key, payload: { prefix, currentValue } });
      toast.success(`${COUNTER_LABELS[counter.key] ?? counter.key} numbering updated`);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not update numbering.'));
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="mb-3 text-sm font-semibold text-[var(--color-navy)]">
        {COUNTER_LABELS[counter.key] ?? counter.key}
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Prefix</label>
          <input
            value={prefix}
            disabled={!canEdit}
            maxLength={10}
            onChange={(e) => setPrefix(e.target.value.replace(/[^A-Za-z]/g, ''))}
            className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] disabled:bg-gray-50"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Last number issued</label>
          <input
            type="number"
            value={currentValue}
            disabled={!canEdit}
            onChange={(e) => setCurrentValue(Number(e.target.value))}
            className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] disabled:bg-gray-50"
          />
        </div>
        <p className="pb-2 text-sm text-gray-400">
          Next number: <span className="font-medium text-gray-600">{prefix}-{counter.financialYear}-{currentValue + 1}</span>
        </p>
        {canEdit && (
          <button
            onClick={onSave}
            disabled={!dirty || update.isPending}
            className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            Save
          </button>
        )}
      </div>
      {lowered && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-600">
          <AlertTriangle className="h-3.5 w-3.5" />
          Lowering this can generate an ID that collides with one already issued.
        </p>
      )}
    </div>
  );
}

export function NumberingSettingsPage() {
  const currentUser = useAuthStore((state) => state.user);
  const canEdit = hasPermission(currentUser, 'clinic:edit');
  const { data: counters, isLoading } = useCountersQuery();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-[var(--color-navy)]">Numbering</h1>
        <p className="text-sm text-gray-500">Prefix and sequence used for patient IDs, visit, bill and certificate numbers.</p>
      </div>

      {isLoading ? (
        <CardGridSkeleton count={4} />
      ) : (
        <div className="flex flex-col gap-3">
          {counters?.map((counter) => (
            <CounterRow key={counter.key} counter={counter} canEdit={canEdit} />
          ))}
        </div>
      )}
    </div>
  );
}
