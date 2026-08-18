import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { Download, Plus, Stethoscope } from 'lucide-react';
import type { Gender, PatientSummary } from '@clinic-care/shared-types';
import { DataTable } from '@/components/DataTable';
import { usePatientsQuery } from '@/hooks/usePatients';
import { useVisitMutations } from '@/hooks/useVisits';
import { downloadCsv } from '@/lib/csv';
import { getErrorMessage } from '@/lib/utils';

const GENDER_LABEL: Record<Gender, string> = { MALE: 'M', FEMALE: 'F', OTHER: 'O' };

export function PatientListPage() {
  const navigate = useNavigate();
  const [gender, setGender] = useState<Gender | ''>('');
  const [city, setCity] = useState('');

  const { data, isLoading } = usePatientsQuery({
    page: 1,
    pageSize: 100,
    gender: gender || undefined,
    city: city || undefined,
  });
  const { create: createVisit, start: startVisit } = useVisitMutations();

  const onNewVisit = async (patientId: string) => {
    try {
      const visit = await createVisit.mutateAsync({ patientId });
      await startVisit.mutateAsync(visit.id);
      navigate(`/visits/${visit.id}`);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not start a new visit.'));
    }
  };

  const columns = useMemo<ColumnDef<PatientSummary, any>[]>(
    () => [
      { accessorKey: 'patientId', header: 'Patient ID' },
      { accessorKey: 'name', header: 'Name' },
      {
        id: 'ageSex',
        header: 'Age/Sex',
        accessorFn: (row) => `${row.age} / ${GENDER_LABEL[row.gender]}`,
      },
      { accessorKey: 'mobile', header: 'Mobile' },
      { accessorKey: 'city', header: 'City', cell: ({ getValue }) => getValue<string | null>() ?? '—' },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div className="flex gap-2">
            <button
              onClick={() => navigate(`/patients/${row.original.id}`)}
              className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              View
            </button>
            <button
              onClick={() => navigate(`/patients/${row.original.id}/edit`)}
              className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              Edit
            </button>
            <button
              onClick={() => onNewVisit(row.original.id)}
              className="flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              <Stethoscope className="h-3.5 w-3.5" /> New Visit
            </button>
          </div>
        ),
      },
    ],
    [navigate, onNewVisit],
  );

  const handleExport = () => {
    if (!data) return;
    downloadCsv(
      `patients-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Patient ID', 'Name', 'Age', 'Gender', 'Mobile', 'City'],
      data.items.map((p) => [p.patientId, p.name, p.age, p.gender, p.mobile, p.city ?? '']),
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-navy)]">Patients</h1>
          <p className="text-sm text-gray-500">{data?.total ?? 0} registered patients</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            disabled={!data?.items.length}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
          <button
            onClick={() => navigate('/patients/new')}
            className="flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> New Patient
          </button>
        </div>
      </div>

      <div className="flex gap-3">
        <select
          value={gender}
          onChange={(e) => setGender(e.target.value as Gender | '')}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
        >
          <option value="">All genders</option>
          <option value="MALE">Male</option>
          <option value="FEMALE">Female</option>
          <option value="OTHER">Other</option>
        </select>
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Filter by city"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400">Loading patients...</p>
      ) : (
        <DataTable columns={columns} data={data?.items ?? []} emptyMessage="No patients found." />
      )}
    </div>
  );
}
