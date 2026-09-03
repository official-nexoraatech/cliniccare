import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Activity, ArrowLeft, CalendarPlus, ClipboardCheck, History, NotebookPen, Plus, X } from 'lucide-react';
import { COMMON_TESTS, FOLLOW_UP_QUICK_OPTIONS, QUICK_ADVICE_TEMPLATES } from '@clinic-care/shared-types';
import {
  useComplaintSuggestions,
  useDiagnosisSuggestions,
  usePatientVisitsQuery,
  useVisitMutations,
  useVisitQuery,
} from '@/hooks/useVisits';
import { useFeeTypesQuery } from '@/hooks/useFeeTypes';
import { SuggestInput } from '@/components/SuggestInput';
import { PatientStrip } from '@/components/PatientStrip';
import { ComplianceEntryModal } from '@/components/ComplianceEntryModal';
import {
  emptyStateClass,
  fieldInputClass,
  fieldLabelClass,
  pageStackClass,
  primaryButtonClass,
  quickChipClass,
  secondaryButtonClass,
  sectionCardClass,
  sectionHeaderClass,
  sectionIconClass,
  smallEmptyStateClass,
  toolbarButtonClass,
} from '@/components/uiStyles';
import { getErrorMessage } from '@/lib/utils';

const BP_REGEX = /^\d{2,3}\/\d{2,3}$/;

// Mirrors apps/api/src/modules/visits/dto/{save-vitals,update-visit}.dto.ts field-for-field
// (see feedback_dual_validation).
const consultationSchema = z.object({
  bp: z.union([z.string().regex(BP_REGEX, 'Format: systolic/diastolic, e.g. 120/80'), z.literal('')]).optional(),
  pulse: z.coerce.number().int().min(20).max(250).optional().or(z.literal('')),
  temperature: z.coerce.number().min(30).max(45).optional().or(z.literal('')),
  weight: z.coerce.number().min(0).max(300).optional().or(z.literal('')),
  height: z.coerce.number().min(0).max(250).optional().or(z.literal('')),
  spo2: z.coerce.number().int().min(0).max(100).optional().or(z.literal('')),
  respiratoryRate: z.coerce.number().int().min(5).max(60).optional().or(z.literal('')),
  sugarRandom: z.coerce.number().int().min(0).max(600).optional().or(z.literal('')),
  vitalNotes: z.string().optional(),
  complaint: z.string().optional(),
  complaintDurationDays: z.coerce.number().int().min(0).max(3650).optional().or(z.literal('')),
  examination: z.string().optional(),
  diagnosis: z.string().optional(),
  advice: z.string().optional(),
  nextFollowUpDate: z.string().optional(),
  followUpAfterDays: z.coerce.number().int().min(1).max(3650).optional().or(z.literal('')),
  consultationFee: z.coerce.number().int().min(0).max(1000000).optional().or(z.literal('')),
  remark: z.string().optional(),
});

type ConsultationFormValues = z.infer<typeof consultationSchema>;

const inputClass = fieldInputClass;
const labelClass = fieldLabelClass;

export function ConsultationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: visit, isLoading } = useVisitQuery(id);
  const { data: previousVisits } = usePatientVisitsQuery(visit?.patientId);
  const { data: feeTypes = [] } = useFeeTypesQuery();
  const { update, saveVitals, adviseLabTests } = useVisitMutations();

  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [customTest, setCustomTest] = useState('');
  const [complianceOpen, setComplianceOpen] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ConsultationFormValues>({ resolver: zodResolver(consultationSchema) });

  const defaultConsultationFee = useMemo(() => {
    const activeFeeTypes = feeTypes.filter((feeType) => feeType.isActive);
    return (
      activeFeeTypes.find((feeType) => feeType.isDefault)?.amount ??
      activeFeeTypes.find((feeType) => /consult|visit|doctor/i.test(feeType.name))?.amount ??
      null
    );
  }, [feeTypes]);

  useEffect(() => {
    if (visit) {
      reset({
        bp: visit.vital?.bp ?? '',
        pulse: visit.vital?.pulse ?? '',
        temperature: visit.vital?.temperature ?? '',
        weight: visit.vital?.weight ?? '',
        height: visit.vital?.height ?? '',
        spo2: visit.vital?.spo2 ?? '',
        respiratoryRate: visit.vital?.respiratoryRate ?? '',
        sugarRandom: visit.vital?.sugarRandom ?? '',
        vitalNotes: visit.vital?.notes ?? '',
        complaint: visit.complaint ?? '',
        complaintDurationDays: visit.complaintDurationDays ?? '',
        examination: visit.examination ?? '',
        diagnosis: visit.diagnosis ?? '',
        advice: visit.advice ?? '',
        nextFollowUpDate: visit.nextFollowUpDate ? visit.nextFollowUpDate.slice(0, 10) : '',
        followUpAfterDays: visit.followUpAfterDays ?? '',
        consultationFee: visit.consultationFee ?? '',
        remark: visit.remark ?? '',
      });
    }
  }, [visit, reset]);

  useEffect(() => {
    if (!visit || visit.consultationFee !== null || defaultConsultationFee === null) return;
    const currentFee = getValues('consultationFee');
    if (currentFee === '' || currentFee === undefined || currentFee === null) {
      setValue('consultationFee', defaultConsultationFee);
    }
  }, [defaultConsultationFee, getValues, setValue, visit]);

  const weight = watch('weight');
  const height = watch('height');
  const liveBmi = useMemo(() => {
    const w = Number(weight);
    const h = Number(height);
    if (!w || !h) return null;
    const heightInMeters = h / 100;
    return Math.round((w / (heightInMeters * heightInMeters)) * 10) / 10;
  }, [weight, height]);

  const complaintValue = watch('complaint') ?? '';
  const diagnosisValue = watch('diagnosis') ?? '';
  const { data: complaintSuggestions = [] } = useComplaintSuggestions(complaintValue);
  const { data: diagnosisSuggestions = [] } = useDiagnosisSuggestions(diagnosisValue);

  const advisedTestNames = useMemo(() => new Set(visit?.labTests.map((t) => t.testName) ?? []), [visit]);

  const toggleTest = (testName: string) => {
    setSelectedTests((prev) =>
      prev.includes(testName) ? prev.filter((t) => t !== testName) : [...prev, testName],
    );
  };

  const addCustomTest = () => {
    const trimmed = customTest.trim();
    if (trimmed && !selectedTests.includes(trimmed) && !advisedTestNames.has(trimmed)) {
      setSelectedTests((prev) => [...prev, trimmed]);
    }
    setCustomTest('');
  };

  const setFollowUpDays = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    setValue('nextFollowUpDate', date.toISOString().slice(0, 10));
    setValue('followUpAfterDays', days);
  };

  const appendAdvice = (template: string) => {
    const current = watch('advice') ?? '';
    setValue('advice', current ? `${current}\n${template}` : template);
  };

  const saveConsultation = async (values: ConsultationFormValues, andPrescribe: boolean) => {
    if (!id || !visit) return;

    try {
      await update.mutateAsync({
        id,
        payload: {
          complaint: values.complaint || undefined,
          complaintDurationDays: values.complaintDurationDays || undefined,
          examination: values.examination || undefined,
          diagnosis: values.diagnosis || undefined,
          advice: values.advice || undefined,
          testsAdvised: [...advisedTestNames, ...selectedTests].join(', ') || undefined,
          nextFollowUpDate: values.nextFollowUpDate
            ? new Date(values.nextFollowUpDate).toISOString()
            : undefined,
          followUpAfterDays: values.followUpAfterDays || undefined,
          consultationFee: values.consultationFee || undefined,
          remark: values.remark || undefined,
          status: 'COMPLETED',
        },
      });

      await saveVitals.mutateAsync({
        id,
        payload: {
          bp: values.bp || undefined,
          pulse: values.pulse || undefined,
          temperature: values.temperature || undefined,
          weight: values.weight || undefined,
          height: values.height || undefined,
          spo2: values.spo2 || undefined,
          respiratoryRate: values.respiratoryRate || undefined,
          sugarRandom: values.sugarRandom || undefined,
          notes: values.vitalNotes || undefined,
        },
      });

      if (selectedTests.length > 0) {
        await adviseLabTests.mutateAsync({ id, payload: { testNames: selectedTests } });
      }

      toast.success('Consultation saved');
      navigate(andPrescribe ? `/visits/${id}/prescription` : '/visits');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not save consultation.'));
    }
  };

  if (isLoading) {
    return <p className="text-sm text-gray-400">Loading consultation...</p>;
  }

  if (!visit) {
    return (
      <div className={emptyStateClass}>
        <h1 className="text-xl font-semibold text-[var(--color-navy)]">Visit not found</h1>
        <button onClick={() => navigate('/visits')} className="mt-3 text-sm text-[var(--color-primary)]">
          Back to today's visits
        </button>
      </div>
    );
  }

  const otherVisits = (previousVisits ?? []).filter((v) => v.id !== visit.id).slice(0, 5);

  return (
    <div className={pageStackClass}>
      <button
        onClick={() => navigate('/visits')}
        className={toolbarButtonClass}
      >
        <ArrowLeft className="h-4 w-4" /> Back to today's visits
      </button>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-5">
          {/* SECTION 1: Patient strip */}
          <PatientStrip patient={visit.patient} visitNo={visit.visitNo} />

          {visit.visitType === 'FOLLOW_UP' && (
            <button
              type="button"
              onClick={() => setComplianceOpen(true)}
              className="flex w-fit items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-semibold text-[var(--color-primary)] transition hover:border-[var(--color-primary)] hover:bg-white focus:outline-none focus:ring-2 focus:ring-teal-100"
            >
              <ClipboardCheck className="h-4 w-4" /> Record Compliance
            </button>
          )}

          <form className="flex flex-col gap-5">
            {/* SECTION 2: Clinical */}
            <div className={sectionCardClass}>
              <p className={sectionHeaderClass}>
                <span className={sectionIconClass}>
                  <Activity className="h-4 w-4" />
                </span>
                Vitals
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <label className={labelClass}>BP</label>
                  <input {...register('bp')} placeholder="120/80" className={inputClass} />
                  {errors.bp && <p className="mt-1 text-xs text-red-600">{errors.bp.message}</p>}
                </div>
                <div>
                  <label className={labelClass}>Pulse</label>
                  <input type="number" {...register('pulse')} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Temp (°C)</label>
                  <input type="number" step="0.1" {...register('temperature')} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>SpO2 (%)</label>
                  <input type="number" {...register('spo2')} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Weight (kg)</label>
                  <input type="number" step="0.1" {...register('weight')} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Height (cm)</label>
                  <input type="number" step="0.1" {...register('height')} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>BMI</label>
                  <div className={`${inputClass} bg-slate-50 font-semibold text-slate-500`}>{liveBmi ?? '—'}</div>
                </div>
                <div>
                  <label className={labelClass}>Random Sugar</label>
                  <input type="number" {...register('sugarRandom')} className={inputClass} />
                </div>
              </div>
            </div>

            <div className={sectionCardClass}>
              <p className={sectionHeaderClass}>
                <span className={sectionIconClass}>
                  <NotebookPen className="h-4 w-4" />
                </span>
                Clinical notes
              </p>
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Chief complaint</label>
                    <SuggestInput
                      value={complaintValue}
                      onChange={(v) => setValue('complaint', v)}
                      suggestions={complaintSuggestions}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Duration (days)</label>
                    <input type="number" {...register('complaintDurationDays')} className={inputClass} />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Examination findings</label>
                  <textarea rows={3} {...register('examination')} className={inputClass} />
                </div>

                <div>
                  <label className={labelClass}>Diagnosis</label>
                  <SuggestInput
                    value={diagnosisValue}
                    onChange={(v) => setValue('diagnosis', v)}
                    suggestions={diagnosisSuggestions}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Tests advised</label>
                  <div className="flex flex-wrap gap-2">
                    {Array.from(advisedTestNames).map((test) => (
                      <span key={test} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-500">
                        {test} (already advised)
                      </span>
                    ))}
                    {COMMON_TESTS.filter((t) => !advisedTestNames.has(t)).map((test) => (
                      <button
                        type="button"
                        key={test}
                        onClick={() => toggleTest(test)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                          selectedTests.includes(test)
                            ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-[var(--color-primary)] hover:bg-teal-50 hover:text-[var(--color-primary)]'
                        }`}
                      >
                        {test}
                      </button>
                    ))}
                    {selectedTests
                      .filter((t) => !(COMMON_TESTS as readonly string[]).includes(t))
                      .map((test) => (
                        <span
                          key={test}
                          className="flex items-center gap-1 rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          {test}
                          <button type="button" onClick={() => toggleTest(test)}>
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <input
                      value={customTest}
                      onChange={(e) => setCustomTest(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addCustomTest();
                        }
                      }}
                      placeholder="Add another test..."
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={addCustomTest}
                      className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-[var(--color-primary)] hover:bg-teal-50 hover:text-[var(--color-primary)]"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add
                    </button>
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Advice / Instructions</label>
                  <textarea rows={3} {...register('advice')} className={inputClass} />
                  <div className="mt-2 flex flex-wrap gap-2">
                    {QUICK_ADVICE_TEMPLATES.map((template) => (
                      <button
                        type="button"
                        key={template}
                        onClick={() => appendAdvice(template)}
                        className={quickChipClass}
                      >
                        + {template}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Consultation Fee (₹)</label>
                  <input type="number" {...register('consultationFee')} className={`${inputClass} sm:w-48`} />
                </div>
              </div>
            </div>

            {/* SECTION 3: Follow-up */}
            <div className={sectionCardClass}>
              <p className={sectionHeaderClass}>
                <span className={sectionIconClass}>
                  <CalendarPlus className="h-4 w-4" />
                </span>
                Follow-up
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {FOLLOW_UP_QUICK_OPTIONS.map((option) => (
                  <button
                    type="button"
                    key={option.label}
                    onClick={() => setFollowUpDays(option.days)}
                    className={quickChipClass}
                  >
                    {option.label}
                  </button>
                ))}
                <input type="date" {...register('nextFollowUpDate')} className={`${inputClass} w-auto`} />
              </div>
            </div>

            <div className="sticky bottom-0 z-10 -mx-1 flex justify-end gap-3 border-t border-slate-200 bg-[var(--color-bg)]/95 px-1 py-4 backdrop-blur">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSubmit((values) => saveConsultation(values, false))}
                className={secondaryButtonClass}
              >
                Save
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSubmit((values) => saveConsultation(values, true))}
                className={primaryButtonClass}
              >
                Save & Write Prescription
              </button>
            </div>
          </form>
        </div>

        {/* Previous visits side panel */}
        <aside className={`${sectionCardClass} h-fit xl:sticky xl:top-20`}>
          <p className={sectionHeaderClass}>
            <span className={sectionIconClass}>
              <History className="h-4 w-4" />
            </span>
            Previous visits
          </p>
          {otherVisits.length === 0 ? (
            <div className={smallEmptyStateClass}>
              No previous visits.
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {otherVisits.map((prev) => (
                <button
                  key={prev.id}
                  onClick={() => navigate(`/visits/${prev.id}`)}
                  className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 text-left text-xs transition hover:border-teal-200 hover:bg-white hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-100"
                >
                  <p className="font-semibold text-[var(--color-navy)]">
                    {new Date(prev.visitDate).toLocaleDateString('en-IN')}
                  </p>
                  <p className="mt-1 line-clamp-2 text-slate-500">{prev.diagnosis || prev.complaint || 'No diagnosis recorded'}</p>
                </button>
              ))}
            </div>
          )}
        </aside>
      </div>

      {id && (
        <ComplianceEntryModal
          open={complianceOpen}
          onClose={() => setComplianceOpen(false)}
          patientId={visit.patientId}
          visitId={id}
        />
      )}
    </div>
  );
}
