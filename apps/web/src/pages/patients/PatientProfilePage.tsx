import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CalendarPlus,
  Camera,
  ClipboardList,
  FileText,
  Layers,
  Paperclip,
  Pencil,
  Printer,
  ShieldCheck,
  ShieldOff,
  Stethoscope,
  Trash2,
  Upload,
  User,
  X,
} from 'lucide-react';
import type { DocumentCategory, PatientCustomFieldValues, PatientHistoryVisit } from '@clinic-care/shared-types';
import { usePatientMutations, usePatientQuery } from '@/hooks/usePatients';
import { usePatientFieldsQuery } from '@/hooks/usePatientFields';
import { usePatientHistoryQuery } from '@/hooks/usePatientHistory';
import { useVisitMutations } from '@/hooks/useVisits';
import { useDocumentMutations } from '@/hooks/useDocuments';
import { usePatientComplianceQuery } from '@/hooks/useCompliance';
import { usePatientFollowUpsQuery } from '@/hooks/useFollowUps';
import { usePatientAppointmentsQuery } from '@/hooks/useAppointments';
import { useBillsByPatientQuery } from '@/hooks/useBilling';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ComplianceBadge } from '@/components/ComplianceBadge';
import { resolveServerUrl } from '@/lib/api';
import { cn, getErrorMessage } from '@/lib/utils';
import {
  calculateAge,
  PatientCustomFields,
  PatientFormFields,
  patientSchema,
  validateCustomFields,
  type PatientFormValues,
} from './patientFormShared';

const GENDER_LABEL: Record<string, string> = { MALE: 'Male', FEMALE: 'Female', OTHER: 'Other', UNSPECIFIED: 'Not specified' };

const TABS = ['Profile', 'All', 'Prescriptions', 'Lab Reports', 'Documents'] as const;
type Tab = (typeof TABS)[number];

const CATEGORY_LABEL: Record<DocumentCategory, string> = {
  LAB_REPORT: 'Lab Report',
  XRAY: 'X-Ray',
  PRESCRIPTION_SCAN: 'Prescription Scan',
  DISCHARGE_SUMMARY: 'Discharge Summary',
  ID_PROOF: 'ID Proof',
  OTHER: 'Other',
};

function VisitCard({ visit, onView, onReprint }: { visit: PatientHistoryVisit; onView: () => void; onReprint: () => void }) {
  const vitalsLine = visit.vital
    ? [
        visit.vital.bp && `BP ${visit.vital.bp}`,
        visit.vital.pulse && `Pulse ${visit.vital.pulse}`,
        visit.vital.weight && `Weight ${visit.vital.weight}kg`,
        visit.vital.temperature && `Temp ${visit.vital.temperature}°C`,
      ]
        .filter(Boolean)
        .join(' · ')
    : null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--color-navy)]">
            {new Date(visit.visitDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
          <p className="text-xs text-gray-400">{visit.visitNo}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onView}
            className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            View Full Visit
          </button>
          {visit.prescription && (
            <button
              onClick={onReprint}
              className="flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              <Printer className="h-3.5 w-3.5" /> Reprint
            </button>
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-col gap-1.5 text-sm">
        {visit.diagnosis && (
          <p>
            <span className="font-medium text-gray-700">Diagnosis:</span> {visit.diagnosis}
          </p>
        )}
        {!visit.diagnosis && visit.complaint && (
          <p>
            <span className="font-medium text-gray-700">Complaint:</span> {visit.complaint}
          </p>
        )}
        {vitalsLine && <p className="text-xs text-gray-500">{vitalsLine}</p>}
        {visit.prescription && (
          <p className="text-xs text-gray-500">
            <ClipboardList className="mr-1 inline h-3.5 w-3.5" />
            {visit.prescription.itemCount} medicine{visit.prescription.itemCount === 1 ? '' : 's'} prescribed
          </p>
        )}
        {visit.labTests.length > 0 && (
          <p className="text-xs text-gray-500">
            Tests: {visit.labTests.map((t) => `${t.testName}${t.status === 'DONE' ? ' (done)' : ''}`).join(', ')}
          </p>
        )}
        {visit.advice && <p className="text-xs text-gray-500">Advice: {visit.advice}</p>}
      </div>
    </div>
  );
}

export function PatientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: patient, isLoading } = usePatientQuery(id);
  const { data: allFieldDefs } = usePatientFieldsQuery();
  const coreFieldDefs = allFieldDefs?.filter((f) => f.isCore);
  const customFieldDefs = allFieldDefs?.filter((f) => !f.isCore);
  const { data: history } = usePatientHistoryQuery(id);
  const { data: compliance } = usePatientComplianceQuery(id);
  const { data: followUps } = usePatientFollowUpsQuery(id);
  const { data: appointments } = usePatientAppointmentsQuery(id);
  const { data: bills } = useBillsByPatientQuery(id);
  const { deactivate, reactivate, update, uploadPhoto } = usePatientMutations();
  const { create: createVisit, start: startVisit } = useVisitMutations();
  const { upload, remove } = useDocumentMutations();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('Profile');
  const [isEditing, setIsEditing] = useState(searchParams.get('edit') === '1');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [customFieldValues, setCustomFieldValues] = useState<PatientCustomFieldValues>({});
  const [customFieldErrors, setCustomFieldErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PatientFormValues>({ resolver: zodResolver(patientSchema) });

  useEffect(() => {
    if (patient) {
      reset({
        name: patient.name,
        age: patient.age,
        dob: patient.dob ? patient.dob.slice(0, 10) : '',
        gender: patient.gender,
        mobile: patient.mobile,
        altMobile: patient.altMobile ?? '',
        email: patient.email ?? '',
        address: patient.address ?? '',
        city: patient.city ?? '',
        pincode: patient.pincode ?? '',
        bloodGroup: (patient.bloodGroup as PatientFormValues['bloodGroup']) ?? '',
        maritalStatus: (patient.maritalStatus as PatientFormValues['maritalStatus']) ?? '',
        occupation: patient.occupation ?? '',
        allergies: patient.allergies ?? '',
        chronicDiseases: patient.chronicDiseases ?? '',
        stage: patient.stage ?? '',
        referredBy: patient.referredBy ?? '',
        notes: patient.notes ?? '',
      });
      setCustomFieldValues(patient.customFields ?? {});
    }
  }, [patient, reset]);

  const dob = watch('dob');
  useEffect(() => {
    if (isEditing && dob) {
      setValue('age', calculateAge(dob), { shouldValidate: true });
    }
  }, [dob, isEditing, setValue]);

  const upcomingAppointments = appointments
    ?.filter((a) => new Date(a.appointmentDate) >= new Date(new Date().toDateString()) && ['BOOKED', 'CONFIRMED'].includes(a.status))
    .slice(0, 3);

  const filteredVisits = useMemo(() => {
    if (!history) return [];
    if (tab === 'Prescriptions') return history.visits.filter((v) => v.prescription);
    if (tab === 'Lab Reports') return history.visits.filter((v) => v.labTests.length > 0);
    return history.visits;
  }, [history, tab]);

  if (isLoading) {
    return <p className="text-sm text-gray-400">Loading patient...</p>;
  }

  if (!patient) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white py-20 text-center">
        <h1 className="text-xl font-semibold text-[var(--color-navy)]">Patient not found</h1>
        <button onClick={() => navigate('/patients')} className="mt-3 text-sm text-[var(--color-primary)]">
          Back to patient list
        </button>
      </div>
    );
  }

  const hasAlerts = Boolean(patient.allergies || patient.chronicDiseases);

  const onNewVisit = async () => {
    try {
      const visit = await createVisit.mutateAsync({ patientId: patient.id });
      await startVisit.mutateAsync(visit.id);
      navigate(`/visits/${visit.id}`);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not start a new visit.'));
    }
  };

  const onToggleActive = async () => {
    try {
      if (patient.isActive) {
        await deactivate.mutateAsync(patient.id);
        toast.success('Patient deactivated');
      } else {
        await reactivate.mutateAsync(patient.id);
        toast.success('Patient reactivated');
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not update patient status.'));
    } finally {
      setConfirmOpen(false);
    }
  };

  const startEditing = () => {
    setTab('Profile');
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setPhotoFile(null);
    setPhotoPreview(null);
    if (searchParams.get('edit')) {
      searchParams.delete('edit');
      setSearchParams(searchParams, { replace: true });
    }
  };

  const onPhotoSelected = (file: File | null) => {
    setPhotoFile(file);
    if (file) setPhotoPreview(URL.createObjectURL(file));
  };

  const onSaveProfile = async (values: PatientFormValues) => {
    const fieldErrors = validateCustomFields(allFieldDefs ?? [], { ...values, ...customFieldValues });
    if (Object.keys(fieldErrors).length > 0) {
      const customKeys = new Set((customFieldDefs ?? []).map((f) => f.key));
      setCustomFieldErrors(Object.fromEntries(Object.entries(fieldErrors).filter(([key]) => customKeys.has(key))));
      toast.error(Object.values(fieldErrors).join(' '));
      return;
    }

    const payload = {
      ...values,
      dob: values.dob || undefined,
      altMobile: values.altMobile || undefined,
      email: values.email || undefined,
      maritalStatus: values.maritalStatus || undefined,
      bloodGroup: values.bloodGroup || undefined,
      customFields: customFieldValues,
    };

    try {
      await update.mutateAsync({ id: patient.id, payload });
      if (photoFile) {
        await uploadPhoto.mutateAsync({ id: patient.id, file: photoFile });
      }
      toast.success('Patient updated');
      cancelEditing();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not save patient.'));
    }
  };

  const onUploadDocument = async (file: File | null) => {
    if (!file || !id) return;
    try {
      await upload.mutateAsync({ patientId: id, file });
      toast.success('Document uploaded');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not upload document.'));
    } finally {
      if (documentInputRef.current) documentInputRef.current.value = '';
    }
  };

  const onDeleteDocument = async (documentId: string) => {
    if (!id) return;
    try {
      await remove.mutateAsync({ id: documentId, patientId: id });
      toast.success('Document removed');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not remove document.'));
    }
  };

  return (
    <div className="w-full">
      <button
        onClick={() => navigate('/patients')}
        className="no-print mb-4 flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" /> Back to patients
      </button>

      <div className="no-print sticky top-0 z-10 -mx-1 mb-4 flex flex-wrap items-center gap-2 bg-[var(--color-bg)] px-1 py-2">
        {isEditing ? (
          <>
            <button
              onClick={handleSubmit(onSaveProfile)}
              disabled={isSubmitting}
              className="rounded-lg bg-[var(--color-primary)] px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={cancelEditing}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              <X className="h-4 w-4" /> Cancel
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onNewVisit}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              <Stethoscope className="h-4 w-4" /> New Visit
            </button>
            <button
              onClick={() => navigate('/appointments')}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              <CalendarPlus className="h-4 w-4" /> New Appointment
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              <Printer className="h-4 w-4" /> Print Case Sheet
            </button>
            <button
              onClick={startEditing}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              <Pencil className="h-4 w-4" /> Edit
            </button>
            <button
              onClick={() => setConfirmOpen(true)}
              className={cn(
                'flex items-center gap-1.5 rounded-lg border bg-white px-3 py-1.5 text-sm',
                patient.isActive
                  ? 'border-red-200 text-red-600 hover:bg-red-50'
                  : 'border-green-200 text-green-600 hover:bg-green-50',
              )}
            >
              {patient.isActive ? (
                <>
                  <ShieldOff className="h-4 w-4" /> Deactivate
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" /> Reactivate
                </>
              )}
            </button>
          </>
        )}
      </div>

      {hasAlerts && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
          <div className="text-sm text-red-800">
            {patient.allergies && (
              <p>
                <span className="font-semibold">Allergies:</span> {patient.allergies}
              </p>
            )}
            {patient.chronicDiseases && (
              <p>
                <span className="font-semibold">Diseases/Conditions:</span> {patient.chronicDiseases}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-start gap-5">
          <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100 text-gray-400">
            {photoPreview || patient.photoPath ? (
              <img
                src={photoPreview ?? resolveServerUrl(patient.photoPath!)}
                alt={patient.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <User className="h-8 w-8" />
            )}
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-[var(--color-navy)]">{patient.name}</h1>
              {!patient.isActive && (
                <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">
                  Inactive
                </span>
              )}
              {compliance?.records[0] && (
                <ComplianceBadge percent={compliance.records[0].overallPercent} grade={compliance.records[0].grade} />
              )}
            </div>
            <p className="text-sm text-gray-500">
              {patient.age} yrs · {GENDER_LABEL[patient.gender]} · {patient.patientId}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-600 sm:grid-cols-3">
              <p>
                <span className="text-gray-400">Mobile:</span> {patient.mobile}
              </p>
              {patient.bloodGroup && (
                <p>
                  <span className="text-gray-400">Blood Group:</span> {patient.bloodGroup}
                </p>
              )}
              {patient.city && (
                <p>
                  <span className="text-gray-400">City:</span> {patient.city}
                </p>
              )}
              {patient.stage && (
                <p>
                  <span className="text-gray-400">Stage:</span> {patient.stage}
                </p>
              )}
              <p>
                <span className="text-gray-400">Visits:</span> {patient.visitCount}
              </p>
              <p>
                <span className="text-gray-400">Next follow-up:</span>{' '}
                {patient.nextFollowUp ? (
                  <span className={new Date(patient.nextFollowUp.dueDate) < new Date() ? 'text-red-600' : ''}>
                    {new Date(patient.nextFollowUp.dueDate).toLocaleDateString('en-IN')}
                  </span>
                ) : (
                  'None due'
                )}
              </p>
            </div>
          </div>

          {isEditing && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
            >
              <Camera className="h-3.5 w-3.5" /> Change Photo
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => onPhotoSelected(e.target.files?.[0] ?? null)}
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        <div className="no-print flex flex-col gap-4">
          {history && (
            <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm">
              <p className="mb-2 font-semibold text-[var(--color-navy)]">Summary</p>
              <div className="flex flex-col gap-1 text-gray-600">
                <p>{history.summary.totalVisits} total visits</p>
                {history.summary.firstVisitDate && (
                  <p>First visit: {new Date(history.summary.firstVisitDate).toLocaleDateString('en-IN')}</p>
                )}
                {history.summary.lastVisitDate && (
                  <p>Last visit: {new Date(history.summary.lastVisitDate).toLocaleDateString('en-IN')}</p>
                )}
                {history.summary.mostPrescribedMedicines.length > 0 && (
                  <div className="mt-1">
                    <p className="text-xs text-gray-400">Most prescribed:</p>
                    {history.summary.mostPrescribedMedicines.map((m) => (
                      <p key={m.medicineName} className="text-xs">
                        {m.medicineName} ({m.count}×)
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {bills && bills.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-semibold text-[var(--color-navy)]">Billing</p>
                <button onClick={() => navigate('/billing')} className="text-xs font-medium text-[var(--color-primary)]">
                  View all
                </button>
              </div>
              <div className="flex flex-col gap-1.5">
                {bills.slice(0, 3).map((b) => (
                  <div key={b.id} className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">
                      {b.billNo} · {new Date(b.date).toLocaleDateString('en-IN')}
                    </span>
                    <span className={b.dueAmount > 0 && b.status !== 'CANCELLED' ? 'font-medium text-red-600' : 'text-gray-600'}>
                      {b.dueAmount > 0 && b.status !== 'CANCELLED' ? `Due ₹${b.dueAmount.toLocaleString('en-IN')}` : b.status === 'CANCELLED' ? 'Cancelled' : 'Paid'}
                    </span>
                  </div>
                ))}
              </div>
              {(() => {
                const totalDue = bills.filter((b) => b.status !== 'CANCELLED').reduce((sum, b) => sum + b.dueAmount, 0);
                return totalDue > 0 ? (
                  <p className="mt-2 border-t border-gray-100 pt-2 text-xs font-medium text-red-600">
                    Total outstanding: ₹{totalDue.toLocaleString('en-IN')}
                  </p>
                ) : null;
              })()}
            </div>
          )}

          {upcomingAppointments && upcomingAppointments.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm">
              <p className="mb-2 flex items-center gap-1.5 font-semibold text-[var(--color-navy)]">
                <CalendarDays className="h-4 w-4" /> Upcoming Appointments
              </p>
              <div className="flex flex-col gap-1.5">
                {upcomingAppointments.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => navigate('/appointments')}
                    className="flex items-center justify-between text-left text-xs hover:text-[var(--color-primary)]"
                  >
                    <span className="text-gray-600">{new Date(a.appointmentDate).toLocaleDateString('en-IN')}</span>
                    <span className="text-gray-400">{a.timeSlot}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {followUps && followUps.given > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm">
              <p className="mb-2 font-semibold text-[var(--color-navy)]">Follow-ups</p>
              <div className="flex justify-between text-gray-600">
                <span>{followUps.given} given</span>
                <span className="text-green-600">{followUps.attended} attended</span>
                <span className="text-red-600">{followUps.missed} missed</span>
              </div>
            </div>
          )}

          {compliance && compliance.trend.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-semibold text-[var(--color-navy)]">Compliance Trend</p>
                {compliance.lifetimeAverage !== null && (
                  <span className="text-xs text-gray-400">Avg {compliance.lifetimeAverage}%</span>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                {compliance.trend.map((record) => (
                  <div key={record.id} className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      {new Date(record.recordedOn).toLocaleDateString('en-IN')}
                    </span>
                    <ComplianceBadge percent={record.overallPercent} grade={record.grade} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="no-print flex gap-1 border-b border-gray-200">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium ${
                  tab === t
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t === 'Profile' && <Layers className="h-3.5 w-3.5" />}
                {t}
              </button>
            ))}
          </div>

          {tab === 'Profile' ? (
            isEditing ? (
              <form onSubmit={handleSubmit(onSaveProfile)}>
                <PatientFormFields register={register} errors={errors} watch={watch} coreFieldDefs={coreFieldDefs} />
                {(customFieldDefs?.length ?? 0) > 0 && (
                  <div className="mt-6">
                    <h2 className="mb-3 text-sm font-semibold text-[var(--color-navy)]">Additional Details</h2>
                    <PatientCustomFields
                      fields={customFieldDefs ?? []}
                      values={customFieldValues}
                      errors={customFieldErrors}
                      onChange={(key, value) => {
                        setCustomFieldValues((prev) => ({ ...prev, [key]: value }));
                        setCustomFieldErrors((prev) => {
                          if (!prev[key]) return prev;
                          const { [key]: _removed, ...rest } = prev;
                          return rest;
                        });
                      }}
                    />
                  </div>
                )}
              </form>
            ) : (
              <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm">
                <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                  <p>
                    <span className="text-gray-400">Address:</span> {patient.address || '—'}
                  </p>
                  <p>
                    <span className="text-gray-400">Alternate Mobile:</span> {patient.altMobile || '—'}
                  </p>
                  <p>
                    <span className="text-gray-400">Email:</span> {patient.email || '—'}
                  </p>
                  <p>
                    <span className="text-gray-400">Pincode:</span> {patient.pincode || '—'}
                  </p>
                  <p>
                    <span className="text-gray-400">Marital Status:</span> {patient.maritalStatus || '—'}
                  </p>
                  <p>
                    <span className="text-gray-400">Occupation:</span> {patient.occupation || '—'}
                  </p>
                  <p>
                    <span className="text-gray-400">Referred By:</span> {patient.referredBy || '—'}
                  </p>
                  <p>
                    <span className="text-gray-400">Registered On:</span>{' '}
                    {new Date(patient.registeredOn).toLocaleDateString('en-IN')}
                  </p>
                  {patient.notes && (
                    <p className="sm:col-span-2">
                      <span className="text-gray-400">Notes:</span> {patient.notes}
                    </p>
                  )}
                  {customFieldDefs
                    ?.filter((f) => f.isActive && String(patient.customFields?.[f.key] ?? '').trim())
                    .map((f) => (
                      <p key={f.id}>
                        <span className="text-gray-400">{f.label}:</span>{' '}
                        {f.fieldType === 'BOOLEAN'
                          ? patient.customFields[f.key] === 'true'
                            ? 'Yes'
                            : 'No'
                          : patient.customFields[f.key]}
                      </p>
                    ))}
                </div>
              </div>
            )
          ) : tab === 'Documents' ? (
            <div className="flex flex-col gap-3">
              <div className="no-print flex items-center justify-between rounded-xl border border-dashed border-gray-300 bg-white p-4">
                <p className="text-sm text-gray-500">Scanned lab reports, X-rays, or other patient documents</p>
                <button
                  onClick={() => documentInputRef.current?.click()}
                  disabled={upload.isPending}
                  className="flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  <Upload className="h-4 w-4" /> {upload.isPending ? 'Uploading...' : 'Upload'}
                </button>
                <input
                  ref={documentInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  className="hidden"
                  onChange={(e) => onUploadDocument(e.target.files?.[0] ?? null)}
                />
              </div>

              {(history?.documents.length ?? 0) === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white py-12 text-center">
                  <Paperclip className="h-6 w-6 text-gray-300" />
                  <p className="mt-2 text-sm text-gray-400">No documents uploaded yet.</p>
                </div>
              ) : (
                history?.documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-3 text-sm"
                  >
                    <a
                      href={resolveServerUrl(doc.filePath)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 hover:opacity-80"
                    >
                      <FileText className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-700">{doc.fileName}</p>
                        <p className="text-xs text-gray-400">
                          {CATEGORY_LABEL[doc.category]} · {new Date(doc.uploadedOn).toLocaleDateString('en-IN')}
                        </p>
                      </div>
                    </a>
                    <button
                      onClick={() => onDeleteDocument(doc.id)}
                      className="no-print text-gray-400 hover:text-red-600"
                      title="Remove document"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          ) : filteredVisits.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
              <Stethoscope className="h-8 w-8 text-gray-300" />
              <p className="mt-2 text-sm text-gray-400">No visits in this category yet.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredVisits.map((visit) => (
                <VisitCard
                  key={visit.id}
                  visit={visit}
                  onView={() => navigate(`/visits/${visit.id}`)}
                  onReprint={() => navigate(`/visits/${visit.id}/prescription`)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={patient.isActive ? `Deactivate ${patient.name}?` : `Reactivate ${patient.name}?`}
        description={
          patient.isActive
            ? "They'll be hidden from the active patient list. Their full record is kept and this can be undone any time."
            : 'They will reappear in the active patient list immediately.'
        }
        confirmLabel={patient.isActive ? 'Deactivate' : 'Reactivate'}
        destructive={patient.isActive}
        onConfirm={onToggleActive}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
