import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Activity, ArrowLeft, CalendarPlus, ChevronRight, ClipboardCheck, CreditCard, FlaskConical, History, NotebookPen, Pill, Plus, X } from 'lucide-react';
import {
  COMMON_TESTS,
  FOLLOW_UP_QUICK_OPTIONS,
  QUICK_ADVICE_TEMPLATES,
  type PatientHistoryVisit,
  type VisitFieldDefinition,
} from '@clinic-care/shared-types';
import {
  useComplaintSuggestions,
  useDiagnosisSuggestions,
  useVisitMutations,
  useVisitQuery,
} from '@/hooks/useVisits';
import { useFeeTypesQuery } from '@/hooks/useFeeTypes';
import { useVisitFieldsQuery } from '@/hooks/useVisitFields';
import { usePatientHistoryQuery } from '@/hooks/usePatientHistory';
import { SuggestInput } from '@/components/SuggestInput';
import { PatientStrip } from '@/components/PatientStrip';
import { ComplianceEntryModal } from '@/components/ComplianceEntryModal';
import { VisitSummaryModal } from '@/components/VisitSummaryModal';
import { FormSkeleton } from '@/components/Skeleton';
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
  customFields: z.record(z.string()).optional(),
});

type ConsultationFormValues = z.infer<typeof consultationSchema>;

const inputClass = fieldInputClass;
const labelClass = fieldLabelClass;

const VITAL_FIELD_KEYS = [
  'bp',
  'pulse',
  'temperature',
  'spo2',
  'weight',
  'height',
  'sugarRandom',
  'respiratoryRate',
  'vitalNotes',
] as const;

const CLINICAL_FIELD_KEYS = [
  'complaint',
  'complaintDurationDays',
  'examination',
  'diagnosis',
  'testsAdvised',
  'billableCharges',
  'advice',
  'consultationFee',
  'remark',
] as const;

function fmtMoney(amount: number) {
  return `Rs ${amount.toLocaleString('en-IN')}`;
}

function fieldIsEmpty(value: unknown) {
  return value === undefined || value === null || String(value).trim() === '';
}

function CustomVisitFieldInput({
  field,
  register,
}: {
  field: VisitFieldDefinition;
  register: ReturnType<typeof useForm<ConsultationFormValues>>['register'];
}) {
  const path = `customFields.${field.key}` as const;
  const label = `${field.label}${field.required ? ' *' : ''}`;

  if (field.fieldType === 'SELECT') {
    return (
      <div>
        <label className={labelClass}>{label}</label>
        <select {...register(path)} className={inputClass}>
          <option value="">Select</option>
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (field.fieldType === 'BOOLEAN') {
    return (
      <div>
        <label className={labelClass}>{label}</label>
        <select {...register(path)} className={inputClass}>
          <option value="">Select</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      </div>
    );
  }

  return (
    <div>
      <label className={labelClass}>{label}</label>
      <input
        type={field.fieldType === 'NUMBER' ? 'number' : field.fieldType === 'DATE' ? 'date' : 'text'}
        {...register(path)}
        className={inputClass}
      />
    </div>
  );
}

export function ConsultationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: visit, isLoading } = useVisitQuery(id);
  const { data: history } = usePatientHistoryQuery(visit?.patientId);
  const { data: feeTypes = [] } = useFeeTypesQuery();
  const { data: visitFields } = useVisitFieldsQuery();
  const { update, saveVitals, adviseLabTests, addBillableCharges } = useVisitMutations();

  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [customTest, setCustomTest] = useState('');
  const [selectedChargeIds, setSelectedChargeIds] = useState<string[]>([]);
  const [customChargeName, setCustomChargeName] = useState('');
  const [customChargeAmount, setCustomChargeAmount] = useState('');
  const [complianceOpen, setComplianceOpen] = useState(false);
  const [viewVisit, setViewVisit] = useState<PatientHistoryVisit | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ConsultationFormValues>({ resolver: zodResolver(consultationSchema) });

  const isSavingConsultation =
    isSubmitting ||
    update.isPending ||
    saveVitals.isPending ||
    adviseLabTests.isPending ||
    addBillableCharges.isPending;

  const visitFieldMap = useMemo(() => new Map((visitFields ?? []).map((field) => [field.key, field])), [visitFields]);
  const hasFieldSettings = Boolean(visitFields?.length);
  const isVisitFieldActive = (key: string) => !hasFieldSettings || visitFieldMap.get(key)?.isActive !== false;
  const isVisitFieldRequired = (key: string) => Boolean(visitFieldMap.get(key)?.isActive && visitFieldMap.get(key)?.required);
  const visitFieldLabel = (key: string, fallback: string) => visitFieldMap.get(key)?.label ?? fallback;
  const requiredLabel = (key: string, fallback: string) =>
    `${visitFieldLabel(key, fallback)}${isVisitFieldRequired(key) ? ' *' : ''}`;
  const customVisitFields = useMemo(
    () => (visitFields ?? []).filter((field) => field.isActive && !field.isCore),
    [visitFields],
  );
  const activeCustomFieldKeys = useMemo(() => new Set(customVisitFields.map((field) => field.key)), [customVisitFields]);

  const vitalsVisible = VITAL_FIELD_KEYS.some(isVisitFieldActive);
  const clinicalVisible = CLINICAL_FIELD_KEYS.some(isVisitFieldActive) || customVisitFields.length > 0;

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
        customFields: visit.customFields ?? {},
      });
    }
  }, [visit, reset]);

  useEffect(() => {
    if (!visit || visit.consultationFee !== null || defaultConsultationFee === null || !isVisitFieldActive('consultationFee')) {
      return;
    }
    const currentFee = getValues('consultationFee');
    if (currentFee === '' || currentFee === undefined || currentFee === null) {
      setValue('consultationFee', defaultConsultationFee);
    }
  }, [defaultConsultationFee, getValues, isVisitFieldActive, setValue, visit]);

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
  const { data: complaintSuggestions = [] } = useComplaintSuggestions(isVisitFieldActive('complaint') ? complaintValue : '');
  const { data: diagnosisSuggestions = [] } = useDiagnosisSuggestions(isVisitFieldActive('diagnosis') ? diagnosisValue : '');

  const advisedTestNames = useMemo(() => new Set(visit?.labTests.map((t) => t.testName) ?? []), [visit]);
  const billableFeeTypes = useMemo(
    () => feeTypes.filter((feeType) => feeType.isActive && !feeType.isDefault && !/consult|visit|doctor/i.test(feeType.name)),
    [feeTypes],
  );
  const selectedCharges = useMemo(
    () =>
      selectedChargeIds
        .map((feeTypeId) => billableFeeTypes.find((feeType) => feeType.id === feeTypeId))
        .filter((feeType): feeType is (typeof billableFeeTypes)[number] => Boolean(feeType)),
    [billableFeeTypes, selectedChargeIds],
  );
  const selectedCustomCharges = useMemo(
    () =>
      selectedChargeIds
        .filter((chargeId) => chargeId.startsWith('custom:'))
        .map((chargeId) => {
          const [, customId, name, amount] = chargeId.split(':');
          return { id: customId, name, amount: Number(amount) };
        })
        .filter((charge) => charge.name && charge.amount > 0),
    [selectedChargeIds],
  );

  const toggleTest = (testName: string) => {
    setSelectedTests((prev) => (prev.includes(testName) ? prev.filter((t) => t !== testName) : [...prev, testName]));
  };

  const toggleCharge = (feeTypeId: string) => {
    setSelectedChargeIds((prev) => (prev.includes(feeTypeId) ? prev.filter((item) => item !== feeTypeId) : [...prev, feeTypeId]));
  };

  const addCustomTest = () => {
    const trimmed = customTest.trim();
    if (trimmed && !selectedTests.includes(trimmed) && !advisedTestNames.has(trimmed)) {
      setSelectedTests((prev) => [...prev, trimmed]);
    }
    setCustomTest('');
  };

  const addCustomCharge = () => {
    const name = customChargeName.trim();
    const amount = Number(customChargeAmount);
    if (!name || amount <= 0) {
      toast.error('Enter charge name and amount.');
      return;
    }
    setSelectedChargeIds((prev) => [...prev, `custom:${crypto.randomUUID()}:${name}:${amount}`]);
    setCustomChargeName('');
    setCustomChargeAmount('');
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
    if (!id || !visit || isSavingConsultation) return;

    const coreValues: Record<string, unknown> = {
      bp: values.bp,
      pulse: values.pulse,
      temperature: values.temperature,
      weight: values.weight,
      height: values.height,
      spo2: values.spo2,
      respiratoryRate: values.respiratoryRate,
      sugarRandom: values.sugarRandom,
      vitalNotes: values.vitalNotes,
      complaint: values.complaint,
      complaintDurationDays: values.complaintDurationDays,
      examination: values.examination,
      diagnosis: values.diagnosis,
      testsAdvised: [...advisedTestNames, ...selectedTests].join(', '),
      billableCharges: selectedChargeIds.join(','),
      advice: values.advice,
      nextFollowUpDate: values.nextFollowUpDate,
      consultationFee: values.consultationFee,
      remark: values.remark,
    };
    const missingCoreField = (visitFields ?? []).find(
      (field) => field.isCore && field.isActive && field.required && fieldIsEmpty(coreValues[field.key]),
    );
    if (missingCoreField) {
      toast.error(`${missingCoreField.label} is required.`);
      return;
    }

    const activeCustomFields = Object.fromEntries(
      Object.entries(values.customFields ?? {})
        .filter(([key]) => activeCustomFieldKeys.has(key))
        .map(([key, value]) => [key, String(value ?? '')]),
    );
    const missingCustomField = customVisitFields.find((field) => field.required && fieldIsEmpty(activeCustomFields[field.key]));
    if (missingCustomField) {
      toast.error(`${missingCustomField.label} is required.`);
      return;
    }

    try {
      const chargeItems = !isVisitFieldActive('billableCharges')
        ? []
        : [
            ...selectedCharges.map((feeType, index) => ({
              feeTypeId: feeType.id,
              name: feeType.name,
              quantity: 1,
              unitAmount: feeType.amount,
              sortOrder: index,
            })),
            ...selectedCustomCharges.map((charge, index) => ({
              name: charge.name,
              quantity: 1,
              unitAmount: charge.amount,
              sortOrder: selectedCharges.length + index,
            })),
          ];
      const testsAdvised = isVisitFieldActive('testsAdvised')
        ? [...advisedTestNames, ...selectedTests].join(', ') || undefined
        : undefined;

      await Promise.all([
        update.mutateAsync({
          id,
          payload: {
            complaint: isVisitFieldActive('complaint') ? values.complaint || undefined : undefined,
            complaintDurationDays: isVisitFieldActive('complaintDurationDays') ? values.complaintDurationDays || undefined : undefined,
            examination: isVisitFieldActive('examination') ? values.examination || undefined : undefined,
            diagnosis: isVisitFieldActive('diagnosis') ? values.diagnosis || undefined : undefined,
            advice: isVisitFieldActive('advice') ? values.advice || undefined : undefined,
            testsAdvised,
            nextFollowUpDate:
              isVisitFieldActive('nextFollowUpDate') && values.nextFollowUpDate
                ? new Date(values.nextFollowUpDate).toISOString()
                : undefined,
            followUpAfterDays: isVisitFieldActive('nextFollowUpDate') ? values.followUpAfterDays || undefined : undefined,
            consultationFee: isVisitFieldActive('consultationFee') ? values.consultationFee || undefined : undefined,
            remark: isVisitFieldActive('remark') ? values.remark || undefined : undefined,
            customFields: activeCustomFields,
            status: 'COMPLETED',
          },
        }),
        saveVitals.mutateAsync({
          id,
          payload: {
            bp: isVisitFieldActive('bp') ? values.bp || undefined : undefined,
            pulse: isVisitFieldActive('pulse') ? values.pulse || undefined : undefined,
            temperature: isVisitFieldActive('temperature') ? values.temperature || undefined : undefined,
            weight: isVisitFieldActive('weight') ? values.weight || undefined : undefined,
            height: isVisitFieldActive('height') ? values.height || undefined : undefined,
            spo2: isVisitFieldActive('spo2') ? values.spo2 || undefined : undefined,
            respiratoryRate: isVisitFieldActive('respiratoryRate') ? values.respiratoryRate || undefined : undefined,
            sugarRandom: isVisitFieldActive('sugarRandom') ? values.sugarRandom || undefined : undefined,
            notes: isVisitFieldActive('vitalNotes') ? values.vitalNotes || undefined : undefined,
          },
        }),
        ...(isVisitFieldActive('testsAdvised') && selectedTests.length > 0
          ? [adviseLabTests.mutateAsync({ id, payload: { testNames: selectedTests } })]
          : []),
        ...(chargeItems.length > 0 ? [addBillableCharges.mutateAsync({ id, payload: { items: chargeItems } })] : []),
      ]);

      toast.success('Consultation saved');
      setSelectedChargeIds([]);
      navigate(andPrescribe ? `/visits/${id}/prescription` : '/visits');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not save consultation.'));
    }
  };

  if (isLoading) {
    return <FormSkeleton sections={3} />;
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

  const otherVisits = (history?.visits ?? []).filter((previousVisit) => previousVisit.id !== visit.id).slice(0, 5);

  return (
    <div className={pageStackClass}>
      <button onClick={() => navigate('/visits')} className={toolbarButtonClass}>
        <ArrowLeft className="h-4 w-4" /> Back to today's visits
      </button>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-5">
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
            {vitalsVisible && (
              <div className={sectionCardClass}>
                <p className={sectionHeaderClass}>
                  <span className={sectionIconClass}>
                    <Activity className="h-4 w-4" />
                  </span>
                  Vitals
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {isVisitFieldActive('bp') && (
                    <div>
                      <label className={labelClass}>{requiredLabel('bp', 'BP')}</label>
                      <input {...register('bp')} placeholder="120/80" className={inputClass} />
                      {errors.bp && <p className="mt-1 text-xs text-red-600">{errors.bp.message}</p>}
                    </div>
                  )}
                  {isVisitFieldActive('pulse') && (
                    <div>
                      <label className={labelClass}>{requiredLabel('pulse', 'Pulse')}</label>
                      <input type="number" {...register('pulse')} className={inputClass} />
                    </div>
                  )}
                  {isVisitFieldActive('temperature') && (
                    <div>
                      <label className={labelClass}>{requiredLabel('temperature', 'Temp (C)')}</label>
                      <input type="number" step="0.1" {...register('temperature')} className={inputClass} />
                    </div>
                  )}
                  {isVisitFieldActive('spo2') && (
                    <div>
                      <label className={labelClass}>{requiredLabel('spo2', 'SpO2 (%)')}</label>
                      <input type="number" {...register('spo2')} className={inputClass} />
                    </div>
                  )}
                  {isVisitFieldActive('weight') && (
                    <div>
                      <label className={labelClass}>{requiredLabel('weight', 'Weight (kg)')}</label>
                      <input type="number" step="0.1" {...register('weight')} className={inputClass} />
                    </div>
                  )}
                  {isVisitFieldActive('height') && (
                    <div>
                      <label className={labelClass}>{requiredLabel('height', 'Height (cm)')}</label>
                      <input type="number" step="0.1" {...register('height')} className={inputClass} />
                    </div>
                  )}
                  {(isVisitFieldActive('weight') || isVisitFieldActive('height')) && (
                    <div>
                      <label className={labelClass}>BMI</label>
                      <div className={`${inputClass} bg-slate-50 font-semibold text-slate-500`}>{liveBmi ?? '-'}</div>
                    </div>
                  )}
                  {isVisitFieldActive('sugarRandom') && (
                    <div>
                      <label className={labelClass}>{requiredLabel('sugarRandom', 'Random Sugar')}</label>
                      <input type="number" {...register('sugarRandom')} className={inputClass} />
                    </div>
                  )}
                  {isVisitFieldActive('respiratoryRate') && (
                    <div>
                      <label className={labelClass}>{requiredLabel('respiratoryRate', 'Respiratory Rate')}</label>
                      <input type="number" {...register('respiratoryRate')} className={inputClass} />
                    </div>
                  )}
                  {isVisitFieldActive('vitalNotes') && (
                    <div className="sm:col-span-4">
                      <label className={labelClass}>{requiredLabel('vitalNotes', 'Vital Notes')}</label>
                      <textarea rows={2} {...register('vitalNotes')} className={inputClass} />
                    </div>
                  )}
                </div>
              </div>
            )}

            {clinicalVisible && (
              <div className={sectionCardClass}>
                <p className={sectionHeaderClass}>
                  <span className={sectionIconClass}>
                    <NotebookPen className="h-4 w-4" />
                  </span>
                  Clinical notes
                </p>
                <div className="flex flex-col gap-4">
                  {(isVisitFieldActive('complaint') || isVisitFieldActive('complaintDurationDays')) && (
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                      {isVisitFieldActive('complaint') && (
                        <div className="sm:col-span-2">
                          <label className={labelClass}>{requiredLabel('complaint', 'Chief complaint')}</label>
                          <SuggestInput
                            value={complaintValue}
                            onChange={(value) => setValue('complaint', value)}
                            suggestions={complaintSuggestions}
                            className={inputClass}
                          />
                        </div>
                      )}
                      {isVisitFieldActive('complaintDurationDays') && (
                        <div>
                          <label className={labelClass}>{requiredLabel('complaintDurationDays', 'Duration (days)')}</label>
                          <input type="number" {...register('complaintDurationDays')} className={inputClass} />
                        </div>
                      )}
                    </div>
                  )}

                  {isVisitFieldActive('examination') && (
                    <div>
                      <label className={labelClass}>{requiredLabel('examination', 'Examination findings')}</label>
                      <textarea rows={3} {...register('examination')} className={inputClass} />
                    </div>
                  )}

                  {isVisitFieldActive('diagnosis') && (
                    <div>
                      <label className={labelClass}>{requiredLabel('diagnosis', 'Diagnosis')}</label>
                      <SuggestInput
                        value={diagnosisValue}
                        onChange={(value) => setValue('diagnosis', value)}
                        suggestions={diagnosisSuggestions}
                        className={inputClass}
                      />
                    </div>
                  )}

                  {isVisitFieldActive('testsAdvised') && (
                    <div>
                      <label className={labelClass}>{requiredLabel('testsAdvised', 'Tests advised')}</label>
                      <div className="flex flex-wrap gap-2">
                        {Array.from(advisedTestNames).map((test) => (
                          <span key={test} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-500">
                            {test} (already advised)
                          </span>
                        ))}
                        {COMMON_TESTS.filter((test) => !advisedTestNames.has(test)).map((test) => (
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
                          .filter((test) => !(COMMON_TESTS as readonly string[]).includes(test))
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
                          onChange={(event) => setCustomTest(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
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
                  )}

                  {isVisitFieldActive('billableCharges') && (
                    <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
                      <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--color-navy)]">
                        <CreditCard className="h-4 w-4 text-[var(--color-primary)]" />
                        {requiredLabel('billableCharges', 'Billable treatment charges')}
                      </p>
                      {billableFeeTypes.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {billableFeeTypes.map((feeType) => (
                            <button
                              type="button"
                              key={feeType.id}
                              onClick={() => toggleCharge(feeType.id)}
                              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                                selectedChargeIds.includes(feeType.id)
                                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                                  : 'border-slate-200 bg-white text-slate-600 hover:border-[var(--color-primary)] hover:bg-teal-50 hover:text-[var(--color-primary)]'
                              }`}
                            >
                              {feeType.name} - {fmtMoney(feeType.amount)}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_120px_auto]">
                        <input
                          value={customChargeName}
                          onChange={(event) => setCustomChargeName(event.target.value)}
                          placeholder="Custom charge name"
                          className={inputClass}
                        />
                        <input
                          type="number"
                          min={1}
                          value={customChargeAmount}
                          onChange={(event) => setCustomChargeAmount(event.target.value)}
                          placeholder="Amount"
                          className={inputClass}
                        />
                        <button
                          type="button"
                          onClick={addCustomCharge}
                          className="flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-[var(--color-primary)] hover:bg-teal-50 hover:text-[var(--color-primary)]"
                        >
                          <Plus className="h-3.5 w-3.5" /> Add
                        </button>
                      </div>
                      {(selectedCharges.length > 0 || selectedCustomCharges.length > 0) && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {selectedCharges.map((feeType) => (
                            <span
                              key={feeType.id}
                              className="flex items-center gap-1 rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white"
                            >
                              {feeType.name} - {fmtMoney(feeType.amount)}
                              <button type="button" onClick={() => toggleCharge(feeType.id)}>
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                          {selectedCustomCharges.map((charge) => (
                            <span
                              key={charge.id}
                              className="flex items-center gap-1 rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white"
                            >
                              {charge.name} - {fmtMoney(charge.amount)}
                              <button
                                type="button"
                                onClick={() => setSelectedChargeIds((prev) => prev.filter((item) => !item.startsWith(`custom:${charge.id}:`)))}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {isVisitFieldActive('advice') && (
                    <div>
                      <label className={labelClass}>{requiredLabel('advice', 'Advice / Instructions')}</label>
                      <textarea rows={3} {...register('advice')} className={inputClass} />
                      <div className="mt-2 flex flex-wrap gap-2">
                        {QUICK_ADVICE_TEMPLATES.map((template) => (
                          <button type="button" key={template} onClick={() => appendAdvice(template)} className={quickChipClass}>
                            + {template}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {isVisitFieldActive('consultationFee') && (
                    <div>
                      <label className={labelClass}>{requiredLabel('consultationFee', 'Consultation Fee (Rs)')}</label>
                      <input type="number" {...register('consultationFee')} className={`${inputClass} sm:w-48`} />
                    </div>
                  )}

                  {isVisitFieldActive('remark') && (
                    <div>
                      <label className={labelClass}>{requiredLabel('remark', 'Remark')}</label>
                      <textarea rows={2} {...register('remark')} className={inputClass} />
                    </div>
                  )}

                  {customVisitFields.length > 0 && (
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                      {customVisitFields.map((field) => (
                        <CustomVisitFieldInput key={field.id} field={field} register={register} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {isVisitFieldActive('nextFollowUpDate') && (
              <div className={sectionCardClass}>
                <p className={sectionHeaderClass}>
                  <span className={sectionIconClass}>
                    <CalendarPlus className="h-4 w-4" />
                  </span>
                  {requiredLabel('nextFollowUpDate', 'Follow-up')}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {FOLLOW_UP_QUICK_OPTIONS.map((option) => (
                    <button type="button" key={option.label} onClick={() => setFollowUpDays(option.days)} className={quickChipClass}>
                      {option.label}
                    </button>
                  ))}
                  <input type="date" {...register('nextFollowUpDate')} className={`${inputClass} w-auto`} />
                </div>
              </div>
            )}

            <div className="sticky bottom-0 z-10 -mx-1 flex justify-end gap-3 border-t border-slate-200 bg-[var(--color-bg)]/95 px-1 py-4 backdrop-blur">
              <button
                type="button"
                disabled={isSavingConsultation}
                onClick={handleSubmit((values) => saveConsultation(values, false))}
                className={secondaryButtonClass}
              >
                Save
              </button>
              <button
                type="button"
                disabled={isSavingConsultation}
                onClick={handleSubmit((values) => saveConsultation(values, true))}
                className={primaryButtonClass}
              >
                Save & Write Prescription
              </button>
            </div>
          </form>
        </div>

        <aside className={`${sectionCardClass} h-fit xl:sticky xl:top-20`}>
          <div className={`${sectionHeaderClass} justify-between`}>
            <span className="flex items-center gap-2">
              <span className={sectionIconClass}>
                <History className="h-4 w-4" />
              </span>
              Previous visits
            </span>
            {otherVisits.length > 0 && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">{otherVisits.length}</span>
            )}
          </div>
          {otherVisits.length === 0 ? (
            <div className={smallEmptyStateClass}>No previous visits.</div>
          ) : (
            <div className="flex flex-col">
              {otherVisits.map((previousVisit, index) => (
                <div key={previousVisit.id} className="flex gap-3">
                  <div className="flex w-2.5 flex-none flex-col items-center">
                    <span className="mt-4.5 h-1.5 w-1.5 flex-none rounded-full bg-[var(--color-primary)]" />
                    {index < otherVisits.length - 1 && <span className="w-px flex-1 bg-slate-200" />}
                  </div>
                  <button
                    onClick={() => setViewVisit(previousVisit)}
                    className="group flex-1 rounded-lg py-2.5 pr-2 text-left text-xs transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-100"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-[var(--color-navy)]">
                        {new Date(previousVisit.visitDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                      <ChevronRight className="h-3.5 w-3.5 flex-none text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[var(--color-primary)]" />
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-slate-500">
                      {previousVisit.diagnosis || previousVisit.complaint || 'No diagnosis recorded'}
                    </p>
                    {(previousVisit.prescription || previousVisit.labTests.length > 0) && (
                      <div className="mt-1.5 flex items-center gap-3 text-slate-400">
                        {previousVisit.prescription && (
                          <span className="flex items-center gap-1">
                            <Pill className="h-3 w-3" /> {previousVisit.prescription.itemCount}
                          </span>
                        )}
                        {previousVisit.labTests.length > 0 && (
                          <span className="flex items-center gap-1">
                            <FlaskConical className="h-3 w-3" /> {previousVisit.labTests.length}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                </div>
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

      {viewVisit && (
        <VisitSummaryModal
          visit={viewVisit}
          documents={history?.documents ?? []}
          onClose={() => setViewVisit(null)}
          onEdit={() => navigate(`/visits/${viewVisit.id}`)}
          onReprint={() => navigate(`/visits/${viewVisit.id}/prescription`)}
        />
      )}
    </div>
  );
}
