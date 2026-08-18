import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { ComplianceGrade, ComplianceReason } from '@clinic-care/shared-types';
import { COMPLIANCE_QUICK_OPTIONS, COMPLIANCE_REASONS } from '@clinic-care/shared-types';
import { FormModal } from './FormModal';
import { ComplianceBadge } from './ComplianceBadge';
import { useComplianceContextQuery, useComplianceMutations } from '@/hooks/useCompliance';
import { getErrorMessage } from '@/lib/utils';

const REASON_LABEL: Record<ComplianceReason, string> = {
  FORGOT: 'Forgot',
  COST: 'Cost',
  SIDE_EFFECT: 'Side effect',
  FELT_BETTER: 'Felt better',
  NOT_AVAILABLE: 'Medicine not available',
  OTHER: 'Other',
};

function toGrade(percent: number): ComplianceGrade {
  if (percent >= 80) return 'GOOD';
  if (percent >= 50) return 'AVERAGE';
  return 'POOR';
}

interface ComplianceEntryModalProps {
  open: boolean;
  onClose: () => void;
  patientId: string;
  visitId: string;
}

export function ComplianceEntryModal({ open, onClose, patientId, visitId }: ComplianceEntryModalProps) {
  const { data: context } = useComplianceContextQuery(open ? patientId : undefined);
  const { record } = useComplianceMutations();

  const [dosesTaken, setDosesTaken] = useState(0);
  const [reason, setReason] = useState<ComplianceReason | ''>('');
  const [remark, setRemark] = useState('');

  useEffect(() => {
    if (context?.dosesPrescribed) {
      setDosesTaken(context.dosesPrescribed);
    }
  }, [context?.dosesPrescribed]);

  const dosesPrescribed = context?.dosesPrescribed ?? null;
  const medicinePercent = dosesPrescribed ? Math.round((dosesTaken / dosesPrescribed) * 1000) / 10 : 0;
  const followUpPercent =
    context && context.followUpsGiven > 0
      ? Math.round((context.followUpsAttended / context.followUpsGiven) * 1000) / 10
      : 0;
  const overallPercent = Math.round((medicinePercent * 0.7 + followUpPercent * 0.3) * 10) / 10;
  const grade = toGrade(overallPercent);
  const belowFull = dosesPrescribed !== null && dosesTaken < dosesPrescribed;

  const onSave = async () => {
    try {
      await record.mutateAsync({
        visitId,
        dosesTaken,
        reasonForMissing: belowFull && reason ? reason : undefined,
        remark: remark || undefined,
      });
      toast.success('Compliance recorded');
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not record compliance.'));
    }
  };

  return (
    <FormModal
      open={open}
      title="Record Compliance"
      size="sm"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={record.isPending || dosesPrescribed === null}
            className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {record.isPending ? 'Saving...' : 'Save'}
          </button>
        </>
      }
    >
      {dosesPrescribed === null ? (
        <p className="text-sm text-gray-500">
          No prescription on record for this patient yet — compliance can't be measured until one exists.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <p className="mb-1 text-sm text-gray-600">
              Prescribed last time: <span className="font-medium text-gray-800">{dosesPrescribed} doses</span>
            </p>
            <p className="mb-2 text-sm font-medium text-gray-700">How many doses did the patient actually take?</p>
            <div className="flex flex-wrap gap-2">
              {COMPLIANCE_QUICK_OPTIONS.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => setDosesTaken(Math.round(option.fraction * dosesPrescribed))}
                  className="rounded-full border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  {option.label} ({Math.round(option.fraction * 100)}%)
                </button>
              ))}
            </div>
            <input
              type="number"
              min={0}
              value={dosesTaken}
              onChange={(e) => setDosesTaken(Math.max(0, Number(e.target.value) || 0))}
              className="mt-2 w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            />
          </div>

          {belowFull && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Reason for missing doses</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as ComplianceReason | '')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              >
                <option value="">Not specified</option>
                {COMPLIANCE_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {REASON_LABEL[r]}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Remark (optional)</label>
            <textarea
              rows={2}
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            />
          </div>

          <div className="rounded-lg bg-gray-50 p-3 text-sm">
            <p className="text-gray-500">Medicine: {medicinePercent}% · Follow-up: {followUpPercent}%</p>
            <div className="mt-1 flex items-center gap-2">
              <span className="font-semibold text-gray-800">Overall: {overallPercent}%</span>
              <ComplianceBadge percent={overallPercent} grade={grade} />
            </div>
          </div>
        </div>
      )}
    </FormModal>
  );
}
