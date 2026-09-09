import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Eye, Plus, Printer, RotateCcw, Save, X } from 'lucide-react';
import type {
  BeforeAfterFood,
  MedicineForm,
  MedicineSearchResult,
  PrescriptionItemInput,
} from '@clinic-care/shared-types';
import { BEFORE_AFTER_FOOD_OPTIONS } from '@clinic-care/shared-types';
import { useVisitQuery } from '@/hooks/useVisits';
import { useLastPrescriptionQuery, usePrescriptionByVisitQuery, usePrescriptionMutations } from '@/hooks/usePrescriptions';
import { useClinicQuery } from '@/hooks/useClinic';
import { PatientStrip } from '@/components/PatientStrip';
import { MedicineSearchInput } from '@/components/MedicineSearchInput';
import { PrintLayout } from '@/components/PrintLayout';
import { FormModal } from '@/components/FormModal';
import { FormSkeleton } from '@/components/Skeleton';
import { compactFieldInputClass, subtleSectionCardClass } from '@/components/uiStyles';
import {
  compactTableBodyClass,
  compactTableCellClass,
  compactTableClass,
  compactTableHeaderCellClass,
  compactTableHeaderClass,
  compactTableRowClass,
  printTableCellClass,
  printTableClass,
  printTableHeaderCellClass,
  printTableHeaderRowClass,
  printTableRowClass,
} from '@/components/tableStyles';
import { getErrorMessage } from '@/lib/utils';

interface Row extends PrescriptionItemInput {
  key: string;
}

const FOOD_LABELS: Record<BeforeAfterFood, string> = {
  BEFORE_FOOD: 'Before Food',
  AFTER_FOOD: 'After Food',
  WITH_FOOD: 'With Food',
  EMPTY_STOMACH: 'Empty Stomach',
  ANYTIME: 'Anytime',
};

const UNIT_WORDS: Record<MedicineForm, string> = {
  TABLET: 'tablet',
  CAPSULE: 'capsule',
  SYRUP: 'ml',
  INJECTION: 'injection',
  OINTMENT: 'application',
  DROPS: 'drop',
  POWDER: 'sachet',
  OTHER: 'dose',
  UNSPECIFIED: 'dose',
};

const TIME_SLOTS: Array<{ key: 'morning' | 'afternoon' | 'evening' | 'night'; label: string }> = [
  { key: 'morning', label: 'Morning' },
  { key: 'afternoon', label: 'Afternoon' },
  { key: 'evening', label: 'Evening' },
  { key: 'night', label: 'Night' },
];

function makeEmptyRow(sortOrder: number): Row {
  return {
    key: crypto.randomUUID(),
    medicineId: '',
    medicineName: '',
    strength: undefined,
    form: 'TABLET',
    dose: '',
    morning: 0,
    afternoon: 0,
    evening: 0,
    night: 0,
    beforeAfterFood: 'ANYTIME',
    durationDays: 5,
    instruction: '',
    sortOrder,
  };
}

function totalQuantity(row: Row): number {
  return (row.morning + row.afternoon + row.evening + row.night) * row.durationDays;
}

function medicineFormLabel(row: Row): string {
  return row.form.charAt(0) + row.form.slice(1).toLowerCase();
}

function doseScheduleChip(row: Row): string {
  const unit = row.form === 'TABLET' ? 'tab' : UNIT_WORDS[row.form];
  return TIME_SLOTS.map((slot) => {
    const count = row[slot.key];
    const suffix = count > 0 ? ` ${unit}` : '';
    return `${slot.label.slice(0, 1)}-${count}${suffix}`;
  }).join(' | ');
}

const inputClass = compactFieldInputClass;
const numClass = `${inputClass} text-center`;

export function PrescriptionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: visit, isLoading: visitLoading } = useVisitQuery(id);
  const { data: prescription } = usePrescriptionByVisitQuery(id);
  const { data: clinic } = useClinicQuery();
  const { save, markPrinted } = usePrescriptionMutations();
  const lastPrescriptionQuery = useLastPrescriptionQuery(visit?.patientId, id);

  const [items, setItems] = useState<Row[]>([makeEmptyRow(0)]);
  const [generalInstruction, setGeneralInstruction] = useState('');
  const [paperSize, setPaperSize] = useState<'A4' | 'A5'>('A4');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [loadedPrescriptionId, setLoadedPrescriptionId] = useState<string | null>(null);

  // Load the saved prescription into the grid once (not on every refetch, so mid-edit doesn't get clobbered).
  useEffect(() => {
    if (prescription && prescription.id !== loadedPrescriptionId) {
      setItems(prescription.items.map((item) => ({ ...item, key: crypto.randomUUID() })));
      setGeneralInstruction(prescription.generalInstruction ?? '');
      setLoadedPrescriptionId(prescription.id);
    }
  }, [prescription, loadedPrescriptionId]);

  // Keep exactly one trailing empty row so the doctor can always start typing the next medicine.
  // The new row's MedicineSearchInput mounts with autoFocus, so this also moves the cursor there.
  useEffect(() => {
    const last = items[items.length - 1];
    if (last && last.medicineId) {
      setItems((prev) => [...prev, makeEmptyRow(prev.length)]);
    }
  }, [items]);

  const addRowIfNeeded = () => {
    setItems((prev) => {
      const last = prev[prev.length - 1];
      return last && !last.medicineId ? prev : [...prev, makeEmptyRow(prev.length)];
    });
  };

  const updateRow = (key: string, patch: Partial<Row>) => {
    setItems((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const selectMedicine = (key: string, medicine: MedicineSearchResult) => {
    if (items.some((row) => row.key !== key && row.medicineId === medicine.id)) {
      toast.error(`${medicine.brandName} is already added to this prescription.`);
      return;
    }
    updateRow(key, {
      medicineId: medicine.id,
      medicineName: medicine.brandName,
      strength: medicine.strength ?? undefined,
      form: medicine.form,
      dose: medicine.defaultDose ?? '',
      morning: medicine.defaultMorning,
      afternoon: medicine.defaultAfternoon,
      evening: medicine.defaultEvening,
      night: medicine.defaultNight,
      beforeAfterFood: medicine.defaultBeforeAfterFood,
      durationDays: medicine.defaultDurationDays ?? 5,
    });
  };

  const removeRow = (key: string) => {
    setItems((prev) => {
      const filtered = prev.filter((row) => row.key !== key);
      return filtered.length > 0 ? filtered.map((row, i) => ({ ...row, sortOrder: i })) : [makeEmptyRow(0)];
    });
  };

  // Bound to every field in a row except the medicine search box, which reserves Enter for
  // picking a highlighted suggestion (see MedicineSearchInput's own onKeyDown).
  const handleFieldKeyDown = (row: Row) => (e: React.KeyboardEvent) => {
    if (e.altKey && e.key === 'Delete') {
      e.preventDefault();
      removeRow(row.key);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      addRowIfNeeded();
    }
  };

  const repeatLast = async () => {
    const { data } = await lastPrescriptionQuery.refetch();
    if (!data || data.length === 0) {
      toast.error('No previous prescription found for this patient.');
      return;
    }
    setItems(data.map((item, i) => ({ ...item, key: crypto.randomUUID(), sortOrder: i })));
    toast.success('Loaded last prescription. Review before saving.');
  };

  // Explicit field list, not a spread: rows loaded from a saved prescription carry PrescriptionItemDetail's
  // extra `id`/`totalQuantity`, and the save endpoint's strict DTO validation (forbidNonWhitelisted) rejects
  // any request that includes them.
  const buildPayloadItems = (): PrescriptionItemInput[] => {
    return items
      .filter((row) => row.medicineId)
      .map((row, index) => ({
        medicineId: row.medicineId,
        medicineName: row.medicineName,
        strength: row.strength,
        form: row.form,
        dose: row.dose,
        morning: row.morning,
        afternoon: row.afternoon,
        evening: row.evening,
        night: row.night,
        beforeAfterFood: row.beforeAfterFood,
        durationDays: row.durationDays,
        instruction: row.instruction,
        sortOrder: index,
      }));
  };

  const doSave = async (andPrint: boolean) => {
    if (!id) return;
    const payloadItems = buildPayloadItems();
    if (payloadItems.length === 0) {
      toast.error('Add at least one medicine.');
      return;
    }
    try {
      const saved = await save.mutateAsync({ visitId: id, payload: { generalInstruction, items: payloadItems } });
      toast.success('Prescription saved');
      if (andPrint) {
        await markPrinted.mutateAsync(saved.id);
        setTimeout(() => window.print(), 100);
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not save prescription.'));
    }
  };

  const handleReprint = async () => {
    if (!prescription) return;
    await markPrinted.mutateAsync(prescription.id);
    setTimeout(() => window.print(), 100);
  };

  const handleGridKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey && e.key.toLowerCase() === 'p') {
      e.preventDefault();
      window.print();
    } else if (e.ctrlKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      doSave(false);
    }
  };

  if (visitLoading) {
    return <FormSkeleton sections={2} />;
  }

  if (!visit) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white py-20 text-center">
        <h1 className="text-xl font-semibold text-[var(--color-navy)]">Visit not found</h1>
        <button onClick={() => navigate('/visits')} className="mt-3 text-sm text-[var(--color-primary)]">
          Back to today's visits
        </button>
      </div>
    );
  }

  const printableItems = items.filter((row) => row.medicineId);
  const patientMeta = [
    `${visit.patient.age} yrs`,
    visit.patient.gender.charAt(0),
    visit.patient.patientId,
    visit.patient.mobile,
  ].filter(Boolean);

  const printBody = (
    <>
      <div className="flex items-start justify-between rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3">
        <div>
          <p className="text-[11px] font-semibold uppercase text-slate-400">Patient</p>
          <p className="mt-1 text-lg font-semibold text-slate-950">{visit.patient.name}</p>
          <p className="mt-0.5 text-xs font-medium text-slate-500">
            {patientMeta.join(' | ')}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-semibold uppercase text-slate-400">Date</p>
          <p className="mt-1 text-sm font-semibold text-slate-700">{new Date().toLocaleDateString('en-IN')}</p>
        </div>
      </div>

      {(visit.vital || visit.diagnosis) && (
        <div className="mt-4 rounded-xl border border-teal-100 bg-teal-50/60 px-4 py-3 text-xs text-slate-600">
          {visit.vital && (
            <div className="flex flex-wrap gap-2">
              {visit.vital.bp && <span className="rounded-lg bg-white px-2.5 py-1 font-medium text-slate-700">BP {visit.vital.bp}</span>}
              {visit.vital.pulse && <span className="rounded-lg bg-white px-2.5 py-1 font-medium text-slate-700">Pulse {visit.vital.pulse}</span>}
              {visit.vital.weight && <span className="rounded-lg bg-white px-2.5 py-1 font-medium text-slate-700">Weight {visit.vital.weight} kg</span>}
              {visit.vital.temperature && <span className="rounded-lg bg-white px-2.5 py-1 font-medium text-slate-700">Temp {visit.vital.temperature} C</span>}
            </div>
          )}
          {visit.diagnosis && (
            <p className={visit.vital ? 'mt-2' : ''}>
              <span className="font-semibold text-slate-800">Diagnosis:</span> {visit.diagnosis}
            </p>
          )}
        </div>
      )}

      <table className={`${printTableClass} mt-6`}>
        <colgroup>
          <col className="w-10" />
          <col className="w-[34%]" />
          <col className="w-[34%]" />
          <col className="w-24" />
          <col className="w-16" />
        </colgroup>
        <thead>
          <tr className={`${printTableHeaderRowClass} text-slate-950`}>
            <th className={`${printTableHeaderCellClass} pr-2 text-center font-bold`}>#</th>
            <th className={`${printTableHeaderCellClass} font-bold`}>Medicine</th>
            <th className={`${printTableHeaderCellClass} font-bold`}>Schedule</th>
            <th className={`${printTableHeaderCellClass} text-center font-bold`}>Duration</th>
            <th className={`${printTableHeaderCellClass} text-right font-bold`}>Qty</th>
          </tr>
        </thead>
        <tbody>
          {printableItems.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-6 text-center text-gray-400">
                No medicines added yet
              </td>
            </tr>
          ) : (
            printableItems.map((row, index) => (
              <tr key={row.key} className={printTableRowClass}>
                <td className="px-3 py-3 text-center align-top">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-500">
                    {index + 1}
                  </span>
                </td>
                <td className={`${printTableCellClass} py-3`}>
                  <p className="text-sm font-semibold text-slate-950">{row.medicineName}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {[row.strength, medicineFormLabel(row)].filter(Boolean).join(' | ')}
                  </p>
                </td>
                <td className={`${printTableCellClass} py-3`}>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                      {doseScheduleChip(row)}
                    </span>
                    <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                      {FOOD_LABELS[row.beforeAfterFood]}
                    </span>
                  </div>
                </td>
                <td className={`${printTableCellClass} py-3 text-center text-sm font-semibold text-slate-700`}>{row.durationDays} days</td>
                <td className={`${printTableCellClass} py-3 text-right text-sm font-semibold text-slate-900`}>{totalQuantity(row)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {generalInstruction && (
        <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3 text-xs leading-relaxed text-slate-700">
          <span className="font-semibold text-slate-900">Instructions:</span> {generalInstruction}
        </div>
      )}
      {visit.nextFollowUpDate && (
        <p className="mt-4 rounded-xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm font-semibold text-[var(--color-primary)]">
          Next follow-up: {new Date(visit.nextFollowUpDate).toLocaleDateString('en-IN')}
        </p>
      )}
    </>
  );

  return (
    <div className="flex flex-col gap-4" onKeyDown={handleGridKeyDown}>
      <style>{`@page { size: ${paperSize}; margin: 12mm; }`}</style>

      <div className="no-print flex flex-col gap-4">
        <button
          onClick={() => navigate(`/visits/${id}`)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" /> Back to consultation
        </button>

        <PatientStrip patient={visit.patient} visitNo={visit.visitNo} />

        <div className={subtleSectionCardClass}>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-[var(--color-navy)]">Medicines</p>
            <button
              type="button"
              onClick={repeatLast}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Repeat last prescription
            </button>
          </div>

          {/* No overflow-x-auto wrapper here: overflow-x:auto forces the browser to also
              compute overflow-y:auto on this container (CSS spec: one axis can't stay
              "visible" once the other is scrollable), which silently clips the medicine
              search dropdown whenever it opens below the container's bottom edge. The
              columns fit at normal widths without horizontal scroll anyway. */}
          <table className={compactTableClass}>
            <thead className={`${compactTableHeaderClass} text-slate-950`}>
              <tr>
                <th className={`${compactTableHeaderCellClass} w-64 font-bold text-slate-950`}>Medicine</th>
                <th className={`${compactTableHeaderCellClass} font-bold text-slate-950`}>Dose</th>
                <th className={`${compactTableHeaderCellClass} w-12 text-center font-bold text-slate-950`}>M</th>
                <th className={`${compactTableHeaderCellClass} w-12 text-center font-bold text-slate-950`}>A</th>
                <th className={`${compactTableHeaderCellClass} w-12 text-center font-bold text-slate-950`}>E</th>
                <th className={`${compactTableHeaderCellClass} w-12 text-center font-bold text-slate-950`}>N</th>
                <th className={`${compactTableHeaderCellClass} w-36 font-bold text-slate-950`}>Before/After Food</th>
                <th className={`${compactTableHeaderCellClass} w-20 text-center font-bold text-slate-950`}>Days</th>
                <th className={`${compactTableHeaderCellClass} w-16 text-center font-bold text-slate-950`}>Qty</th>
                <th className={`${compactTableHeaderCellClass} font-bold text-slate-950`}>Instruction</th>
                <th className={`${compactTableHeaderCellClass} w-8`} />
              </tr>
            </thead>
            <tbody className={compactTableBodyClass}>
              {items.map((row, index) => {
                const onFieldKeyDown = handleFieldKeyDown(row);
                return (
                  <tr key={row.key} className={compactTableRowClass}>
                    <td className={compactTableCellClass}>
                      {row.medicineId ? (
                        <div className="flex items-center justify-between gap-1 rounded-lg border border-gray-300 bg-gray-50 px-2 py-1.5 text-sm">
                          <span className="truncate font-medium text-gray-800">
                            {row.medicineName} {row.strength}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateRow(row.key, { medicineId: '', medicineName: '', strength: undefined })}
                            className="flex-shrink-0 text-gray-400 hover:text-red-600"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <MedicineSearchInput
                          onSelect={(medicine) => selectMedicine(row.key, medicine)}
                          autoFocus={index === items.length - 1}
                        />
                      )}
                    </td>
                    <td className={compactTableCellClass}>
                      <input
                        value={row.dose ?? ''}
                        onChange={(e) => updateRow(row.key, { dose: e.target.value })}
                        onKeyDown={onFieldKeyDown}
                        className={inputClass}
                      />
                    </td>
                    {TIME_SLOTS.map((slot) => (
                      <td key={slot.key} className="px-1 py-2">
                        <input
                          type="number"
                          min={0}
                          max={10}
                          value={row[slot.key]}
                          onChange={(e) => updateRow(row.key, { [slot.key]: Number(e.target.value) || 0 })}
                          onKeyDown={onFieldKeyDown}
                          className={numClass}
                        />
                      </td>
                    ))}
                    <td className={compactTableCellClass}>
                      <select
                        value={row.beforeAfterFood}
                        onChange={(e) => updateRow(row.key, { beforeAfterFood: e.target.value as BeforeAfterFood })}
                        onKeyDown={onFieldKeyDown}
                        className={inputClass}
                      >
                        {BEFORE_AFTER_FOOD_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {FOOD_LABELS[option]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className={compactTableCellClass}>
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={row.durationDays}
                        onChange={(e) => updateRow(row.key, { durationDays: Number(e.target.value) || 1 })}
                        onKeyDown={onFieldKeyDown}
                        className={numClass}
                      />
                    </td>
                    <td className={`${compactTableCellClass} text-center text-gray-500`}>{row.medicineId ? totalQuantity(row) : '-'}</td>
                    <td className={compactTableCellClass}>
                      <input
                        value={row.instruction ?? ''}
                        onChange={(e) => updateRow(row.key, { instruction: e.target.value })}
                        onKeyDown={onFieldKeyDown}
                        className={inputClass}
                      />
                    </td>
                    <td className="px-1 py-2 text-center">
                      {items.length > 1 && (
                        <button type="button" onClick={() => removeRow(row.key)} className="text-gray-400 hover:text-red-600">
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <p className="mt-2 text-xs text-gray-400">
            Tab across fields | Enter adds a row | Alt+Delete removes a row | Ctrl+S saves | Ctrl+P prints
          </p>
        </div>

        <div className={subtleSectionCardClass}>
          <p className="mb-2 text-sm font-semibold text-[var(--color-navy)]">General Instruction</p>
          <textarea
            rows={2}
            value={generalInstruction}
            onChange={(e) => setGeneralInstruction(e.target.value)}
            className={inputClass}
          />
          {visit.advice && (
            <p className="mt-2 text-xs text-gray-500">
              <span className="font-medium">Advice from consultation:</span> {visit.advice}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            Paper size:
            {(['A4', 'A5'] as const).map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => setPaperSize(size)}
                className={`rounded-full border px-2.5 py-1 font-medium ${
                  paperSize === size
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                    : 'border-gray-300 text-gray-600'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            {prescription && (
              <button
                type="button"
                onClick={handleReprint}
                className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                <Printer className="h-4 w-4" /> Print / Reprint
              </button>
            )}
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              <Eye className="h-4 w-4" /> Print Preview
            </button>
            <button
              type="button"
              disabled={save.isPending}
              onClick={() => doSave(false)}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-primary)] hover:bg-teal-50 disabled:opacity-50"
            >
              <Save className="h-4 w-4" /> Save
            </button>
            <button
              type="button"
              disabled={save.isPending}
              onClick={() => doSave(true)}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> Save & Print
            </button>
          </div>
        </div>
      </div>

      {clinic && (
        <div className="hidden print:block">
          <PrintLayout clinic={clinic} documentTitle="Prescription">
            {printBody}
          </PrintLayout>
        </div>
      )}

      {clinic && (
        <FormModal open={previewOpen} title="Print Preview" onClose={() => setPreviewOpen(false)} size="lg">
          <PrintLayout clinic={clinic} documentTitle="Prescription" onPrint={() => { setPreviewOpen(false); doSave(true); }}>
            {printBody}
          </PrintLayout>
        </FormModal>
      )}
    </div>
  );
}
