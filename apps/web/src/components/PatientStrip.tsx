import { AlertTriangle, User } from 'lucide-react';
import type { VisitPatientSummary } from '@clinic-care/shared-types';
import {
  patientAlertClass,
  patientAvatarClass,
  patientMetaClass,
  patientNameClass,
  patientStripClass,
  visitBadgeClass,
} from '@/components/uiStyles';

interface PatientStripProps {
  patient: VisitPatientSummary;
  visitNo: string;
}

export function PatientStrip({ patient, visitNo }: PatientStripProps) {
  const hasAlerts = Boolean(patient.allergies || patient.chronicDiseases);

  return (
    <div className={patientStripClass}>
      <div className="flex items-center gap-4">
        <div className={patientAvatarClass}>
          <User className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <p className={patientNameClass}>{patient.name}</p>
          <p className={patientMetaClass}>
            {patient.age} yrs · {patient.gender} · {patient.patientId} · {patient.mobile}
          </p>
        </div>
        <span className={visitBadgeClass}>{visitNo}</span>
      </div>
      {hasAlerts && (
        <div className={patientAlertClass}>
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
