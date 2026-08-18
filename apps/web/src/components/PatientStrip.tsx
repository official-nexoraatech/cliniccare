import { AlertTriangle, User } from 'lucide-react';
import type { VisitPatientSummary } from '@clinic-care/shared-types';
import { resolveServerUrl } from '@/lib/api';

interface PatientStripProps {
  patient: VisitPatientSummary;
  visitNo: string;
}

export function PatientStrip({ patient, visitNo }: PatientStripProps) {
  const hasAlerts = Boolean(patient.allergies || patient.chronicDiseases);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100 text-gray-400">
          {patient.photoPath ? (
            <img
              src={resolveServerUrl(patient.photoPath)}
              alt={patient.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <User className="h-6 w-6" />
          )}
        </div>
        <div className="flex-1">
          <p className="font-semibold text-[var(--color-navy)]">{patient.name}</p>
          <p className="text-xs text-gray-500">
            {patient.age} yrs · {patient.gender} · {patient.patientId} · {patient.mobile}
          </p>
        </div>
        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">{visitNo}</span>
      </div>
      {hasAlerts && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
          <div>
            {patient.allergies && (
              <p>
                <span className="font-semibold">Allergies:</span> {patient.allergies}
              </p>
            )}
            {patient.chronicDiseases && (
              <p>
                <span className="font-semibold">Chronic:</span> {patient.chronicDiseases}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
