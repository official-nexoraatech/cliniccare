import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertTriangle, ArrowLeft, Plus, User, X } from 'lucide-react';
import { COMMON_TESTS, FOLLOW_UP_QUICK_OPTIONS, QUICK_ADVICE_TEMPLATES } from '@clinic-care/shared-types';
import {
  useComplaintSuggestions,
  useDiagnosisSuggestions,
  usePatientVisitsQuery,
  useVisitMutations,
  useVisitQuery,
} from '@/hooks/useVisits';
import { SuggestInput } from '@/components/SuggestInput';
import { resolveServerUrl } from '@/lib/api';
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

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]';
const labelClass = 'mb-1 block text-xs font-medium text-gray-500';

export function ConsultationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: visit, isLoading } = useVisitQuery(id);
  const { data: previousVisits } = usePatientVisitsQuery(visit?.patientId);
  const { update, saveVitals, adviseLabTests } = useVisitMutations();

  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [customTest, setCustomTest] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ConsultationFormValues>({ resolver: zodResolver(consultationSchema) });

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
      navigate(andPrescribe ? '/prescriptions' : '/visits');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not save consultation.'));
    }
  };

  if (isLoading) {
    return <p className="text-sm text-gray-400">Loading consultation...</p>;
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

  const hasAlerts = Boolean(visit.patient.allergies || visit.patient.chronicDiseases);
  const otherVisits = (previousVisits ?? []).filter((v) => v.id !== visit.id).slice(0, 5);

  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={() => navigate('/visits')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" /> Back to today's visits
      </button>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
        <div className="flex flex-col gap-4">
          {/* SECTION 1: Patient strip */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100 text-gray-400">
                {visit.patient.photoPath ? (
                  <img
                    src={resolveServerUrl(visit.patient.photoPath)}
                    alt={visit.patient.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <User className="h-6 w-6" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-[var(--color-navy)]">{visit.patient.name}</p>
                <p className="text-xs text-gray-500">
                  {visit.patient.age} yrs · {visit.patient.gender} · {visit.patient.patientId} ·{' '}
                  {visit.patient.mobile}
                </p>
              </div>
              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                {visit.visitNo}
              </span>
            </div>
            {hasAlerts && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
                <div>
                  {visit.patient.allergies && (
                    <p>
                      <span className="font-semibold">Allergies:</span> {visit.patient.allergies}
                    </p>
                  )}
                  {visit.patient.chronicDiseases && (
                    <p>
                      <span className="font-semibold">Chronic:</span> {visit.patient.chronicDiseases}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <form className="flex flex-col gap-4">
            {/* SECTION 2: Clinical */}
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="mb-3 text-sm font-semibold text-[var(--color-navy)]">Vitals</p>
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
                  <div className={`${inputClass} bg-gray-50 text-gray-500`}>{liveBmi ?? '—'}</div>
                </div>
                <div>
                  <label className={labelClass}>Random Sugar</label>
                  <input type="number" {...register('sugarRandom')} className={inputClass} />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="mb-3 text-sm font-semibold text-[var(--color-navy)]">Clinical Notes</p>
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Chief Complaint</label>
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
                  <label className={labelClass}>Examination Findings</label>
                  <textarea rows={2} {...register('examination')} className={inputClass} />
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
                  <label className={labelClass}>Tests Advised</label>
                  <div className="flex flex-wrap gap-2">
                    {Array.from(advisedTestNames).map((test) => (
                      <span key={test} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-500">
                        {test} (already advised)
                      </span>
                    ))}
                    {COMMON_TESTS.filter((t) => !advisedTestNames.has(t)).map((test) => (
                      <button
                        type="button"
                        key={test}
                        onClick={() => toggleTest(test)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium ${
                          selectedTests.includes(test)
                            ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                            : 'border-gray-300 text-gray-600 hover:bg-gray-50'
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
                          className="flex items-center gap-1 rounded-full bg-[var(--color-primary)] px-3 py-1 text-xs text-white"
                        >
                          {test}
                          <button type="button" onClick={() => toggleTest(test)}>
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                  </div>
                  <div className="mt-2 flex gap-2">
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
                      className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
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
                        className="rounded-full border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
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
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="mb-3 text-sm font-semibold text-[var(--color-navy)]">Follow-up</p>
              <div className="flex flex-wrap items-center gap-2">
                {FOLLOW_UP_QUICK_OPTIONS.map((option) => (
                  <button
                    type="button"
                    key={option.label}
                    onClick={() => setFollowUpDays(option.days)}
                    className="rounded-full border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                  >
                    {option.label}
                  </button>
                ))}
                <input type="date" {...register('nextFollowUpDate')} className={`${inputClass} w-auto`} />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSubmit((values) => saveConsultation(values, false))}
                className="rounded-lg border border-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-[var(--color-primary)] hover:bg-teal-50 disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSubmit((values) => saveConsultation(values, true))}
                className="rounded-lg bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                Save & Write Prescription
              </button>
            </div>
          </form>
        </div>

        {/* Previous visits side panel */}
        <div className="h-fit rounded-xl border border-gray-200 bg-white p-4">
          <p className="mb-3 text-sm font-semibold text-[var(--color-navy)]">Previous Visits</p>
          {otherVisits.length === 0 ? (
            <p className="text-xs text-gray-400">No previous visits.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {otherVisits.map((prev) => (
                <button
                  key={prev.id}
                  onClick={() => navigate(`/visits/${prev.id}`)}
                  className="rounded-lg border border-gray-100 p-2 text-left text-xs hover:bg-gray-50"
                >
                  <p className="font-medium text-gray-700">
                    {new Date(prev.visitDate).toLocaleDateString('en-IN')}
                  </p>
                  <p className="text-gray-500">{prev.diagnosis || prev.complaint || 'No diagnosis recorded'}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
