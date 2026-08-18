import { useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  ClipboardList,
  FileText,
  Paperclip,
  Printer,
  Stethoscope,
  Trash2,
  Upload,
  User,
} from 'lucide-react';
import type { DocumentCategory, PatientHistoryVisit } from '@clinic-care/shared-types';
import { usePatientQuery } from '@/hooks/usePatients';
import { usePatientHistoryQuery } from '@/hooks/usePatientHistory';
import { useDocumentMutations } from '@/hooks/useDocuments';
import { usePatientComplianceQuery } from '@/hooks/useCompliance';
import { usePatientFollowUpsQuery } from '@/hooks/useFollowUps';
import { usePatientAppointmentsQuery } from '@/hooks/useAppointments';
import { ComplianceBadge } from '@/components/ComplianceBadge';
import { resolveServerUrl } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';

const GENDER_LABEL: Record<string, string> = { MALE: 'Male', FEMALE: 'Female', OTHER: 'Other' };

const TABS = ['All', 'Visits', 'Prescriptions', 'Lab Reports', 'Documents'] as const;
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

export function PatientHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: patient } = usePatientQuery(id);
  const { data: history, isLoading } = usePatientHistoryQuery(id);
  const { data: compliance } = usePatientComplianceQuery(id);
  const { data: followUps } = usePatientFollowUpsQuery(id);
  const { data: appointments } = usePatientAppointmentsQuery(id);
  const upcomingAppointments = appointments
    ?.filter((a) => new Date(a.appointmentDate) >= new Date(new Date().toDateString()) && ['BOOKED', 'CONFIRMED'].includes(a.status))
    .slice(0, 3);
  const { upload, remove } = useDocumentMutations();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<Tab>('All');

  const filteredVisits = useMemo(() => {
    if (!history) return [];
    if (tab === 'Prescriptions') return history.visits.filter((v) => v.prescription);
    if (tab === 'Lab Reports') return history.visits.filter((v) => v.labTests.length > 0);
    if (tab === 'Documents') return [];
    return history.visits;
  }, [history, tab]);

  const onUploadClick = () => fileInputRef.current?.click();

  const onFileSelected = async (file: File | null) => {
    if (!file || !id) return;
    try {
      await upload.mutateAsync({ patientId: id, file });
      toast.success('Document uploaded');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not upload document.'));
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
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

  if (isLoading || !patient) {
    return <p className="text-sm text-gray-400">Loading patient history...</p>;
  }

  const hasAlerts = Boolean(patient.allergies || patient.chronicDiseases);

  return (
    <div className="w-full">
      <div className="no-print mb-4 flex items-center justify-between">
        <button
          onClick={() => navigate(`/patients/${id}`)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" /> Back to profile
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
        >
          <Printer className="h-4 w-4" /> Print Full Case Sheet
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-gray-100 text-gray-400">
                {patient.photoPath ? (
                  <img src={resolveServerUrl(patient.photoPath)} alt={patient.name} className="h-full w-full object-cover" />
                ) : (
                  <User className="h-7 w-7" />
                )}
              </div>
              <p className="mt-2 font-semibold text-[var(--color-navy)]">{patient.name}</p>
              <p className="text-xs text-gray-500">
                {patient.age} yrs · {GENDER_LABEL[patient.gender]} · {patient.patientId}
              </p>
              <p className="text-xs text-gray-500">{patient.mobile}</p>
              {patient.bloodGroup && <p className="text-xs text-gray-500">Blood Group: {patient.bloodGroup}</p>}
            </div>

            {hasAlerts && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-2.5 text-xs text-red-800">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-red-600" />
                <div>
                  {patient.allergies && <p>{patient.allergies}</p>}
                  {patient.chronicDiseases && <p>{patient.chronicDiseases}</p>}
                </div>
              </div>
            )}
          </div>

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
                className={`border-b-2 px-3 py-2 text-sm font-medium ${
                  tab === t
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === 'Documents' ? (
            <div className="flex flex-col gap-3">
              <div className="no-print flex items-center justify-between rounded-xl border border-dashed border-gray-300 bg-white p-4">
                <p className="text-sm text-gray-500">Scanned lab reports, X-rays, or other patient documents</p>
                <button
                  onClick={onUploadClick}
                  disabled={upload.isPending}
                  className="flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  <Upload className="h-4 w-4" /> {upload.isPending ? 'Uploading...' : 'Upload'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  className="hidden"
                  onChange={(e) => onFileSelected(e.target.files?.[0] ?? null)}
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
    </div>
  );
}
