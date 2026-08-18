import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarPlus,
  History,
  Pencil,
  Printer,
  ShieldCheck,
  ShieldOff,
  Stethoscope,
  User,
} from 'lucide-react';
import { usePatientMutations, usePatientQuery } from '@/hooks/usePatients';
import { useVisitMutations } from '@/hooks/useVisits';
import { usePatientComplianceQuery } from '@/hooks/useCompliance';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ComplianceBadge } from '@/components/ComplianceBadge';
import { resolveServerUrl } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';

const GENDER_LABEL: Record<string, string> = { MALE: 'Male', FEMALE: 'Female', OTHER: 'Other' };

export function PatientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: patient, isLoading } = usePatientQuery(id);
  const { data: compliance } = usePatientComplianceQuery(id);
  const { deactivate, reactivate } = usePatientMutations();
  const { create: createVisit, start: startVisit } = useVisitMutations();
  const [confirmOpen, setConfirmOpen] = useState(false);

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
    if (!patient) return;
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

  return (
    <div className="w-full">
      <button
        onClick={() => navigate('/patients')}
        className="mb-4 flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" /> Back to patients
      </button>

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
                <span className="font-semibold">Chronic Conditions:</span> {patient.chronicDiseases}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-start gap-5">
          <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100 text-gray-400">
            {patient.photoPath ? (
              <img
                src={resolveServerUrl(patient.photoPath)}
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
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
          <button
            onClick={onNewVisit}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            <Stethoscope className="h-4 w-4" /> New Visit
          </button>
          <button
            onClick={() => navigate('/appointments')}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            <CalendarPlus className="h-4 w-4" /> New Appointment
          </button>
          <button
            onClick={() => navigate(`/patients/${patient.id}/history`)}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            <History className="h-4 w-4" /> View History
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            <Printer className="h-4 w-4" /> Print Card
          </button>
          <button
            onClick={() => navigate(`/patients/${patient.id}/edit`)}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            <Pencil className="h-4 w-4" /> Edit
          </button>
          <button
            onClick={() => setConfirmOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
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
