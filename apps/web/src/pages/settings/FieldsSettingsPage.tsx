import { useState } from 'react';
import { ClipboardList, Pill, Stethoscope } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PatientFieldsPage } from './PatientFieldsPage';
import { MedicineFieldsPage } from './MedicineFieldsPage';
import { VisitFieldsPage } from './VisitFieldsPage';

const FIELD_TABS = [
  { key: 'patient', label: 'Patient Fields', icon: ClipboardList },
  { key: 'medicine', label: 'Medicine Fields', icon: Pill },
  { key: 'visit', label: 'Visit Fields', icon: Stethoscope },
] as const;

type FieldTabKey = (typeof FIELD_TABS)[number]['key'];

export function FieldsSettingsPage() {
  const [activeTab, setActiveTab] = useState<FieldTabKey>('patient');

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold text-[var(--color-navy)]">Fields Settings</h1>
        <p className="text-sm text-gray-500">
          Add and manage extra fields used in patient registration, medicine records, and consultation visits.
        </p>
      </div>

      <div className="flex w-fit gap-1 rounded-lg bg-gray-100 p-1">
        {FIELD_TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition',
              activeTab === key
                ? 'bg-white text-[var(--color-primary)] shadow-sm'
                : 'text-gray-500 hover:text-gray-700',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'patient' ? (
        <PatientFieldsPage />
      ) : activeTab === 'medicine' ? (
        <MedicineFieldsPage />
      ) : (
        <VisitFieldsPage />
      )}
    </div>
  );
}
