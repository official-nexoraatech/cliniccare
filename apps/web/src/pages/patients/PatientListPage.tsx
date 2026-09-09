import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { CalendarDays, ChevronLeft, ChevronRight, Download, Eye, Pencil, Plus, Stethoscope, X } from 'lucide-react';
import type { Gender, PatientSummary } from '@clinic-care/shared-types';
import { DataTable } from '@/components/DataTable';
import { SearchBox } from '@/components/SearchBox';
import { TableSkeleton } from '@/components/Skeleton';
import { usePatientsQuery } from '@/hooks/usePatients';
import { useVisitMutations } from '@/hooks/useVisits';
import { downloadCsv } from '@/lib/csv';
import { getErrorMessage } from '@/lib/utils';

const GENDER_LABEL: Record<Gender, string> = { MALE: 'M', FEMALE: 'F', OTHER: 'O', UNSPECIFIED: '—' };
const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
const filterControlClass =
  'h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm shadow-slate-200/40 transition focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/10';

type DatePreset = 'today' | 'week' | 'month' | 'custom' | null;

function isoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function presetRange(preset: 'today' | 'week' | 'month'): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  if (preset === 'week') from.setDate(from.getDate() - 7);
  if (preset === 'month') from.setDate(from.getDate() - 30);
  return { from: isoDate(from), to: isoDate(to) };
}

export function PatientListPage() {
  const navigate = useNavigate();
  const [gender, setGender] = useState<Gender | ''>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [datePreset, setDatePreset] = useState<DatePreset>(null);
  const [registeredFrom, setRegisteredFrom] = useState('');
  const [registeredTo, setRegisteredTo] = useState('');

  const { data, isLoading } = usePatientsQuery({
    page,
    pageSize,
    gender: gender || undefined,
    search: search || undefined,
    registeredFrom: registeredFrom || undefined,
    registeredTo: registeredTo || undefined,
  });
  const { create: createVisit, start: startVisit } = useVisitMutations();

  const applyPreset = (preset: 'today' | 'week' | 'month') => {
    setDatePreset(preset);
    const { from, to } = presetRange(preset);
    setRegisteredFrom(from);
    setRegisteredTo(to);
    setPage(1);
  };

  const clearDateFilter = () => {
    setDatePreset(null);
    setRegisteredFrom('');
    setRegisteredTo('');
    setPage(1);
  };

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
      { accessorKey: 'stage', header: 'Stage', cell: ({ getValue }) => getValue<string | null>() ?? '—' },
      { accessorKey: 'visitCount', header: 'Visits' },
      {
        id: 'actions',
        header: 'Actions',
        meta: { align: 'center' },
        cell: ({ row }) => (
          <div className="flex justify-center gap-2">
            <button
              onClick={() => navigate(`/patients/${row.original.id}`)}
              className="flex items-center gap-1 rounded-lg border border-blue-200 px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
            >
              <Eye className="h-3.5 w-3.5" /> View
            </button>
            <button
              onClick={() => navigate(`/patients/${row.original.id}?edit=1`)}
              className="flex items-center gap-1 rounded-lg border border-amber-200 px-2.5 py-1 text-xs font-medium text-amber-600 hover:bg-amber-50"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
            <button
              onClick={() => onNewVisit(row.original.id)}
              className="flex items-center gap-1 rounded-lg border border-green-200 px-2.5 py-1 text-xs font-medium text-green-600 hover:bg-green-50"
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
      ['Patient ID', 'Name', 'Age', 'Gender', 'Mobile', 'City', 'Stage', 'Visits'],
      data.items.map((p) => [p.patientId, p.name, p.age, p.gender, p.mobile, p.city ?? '', p.stage ?? '', p.visitCount]),
    );
  };

  const totalPages = data ? Math.max(Math.ceil(data.total / data.pageSize), 1) : 1;

  const presetClass = (preset: DatePreset) =>
    `h-9 rounded-md px-3 text-sm font-medium transition ${
      datePreset === preset
        ? 'bg-[var(--color-primary)] text-white shadow-sm shadow-slate-300'
        : 'text-slate-500 hover:bg-white hover:text-slate-800'
    }`;

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

      <div className="rounded-xl border border-slate-200 bg-white/85 p-3 shadow-sm shadow-slate-200/70">
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-full min-w-0 sm:w-72 lg:w-80">
            <SearchBox
              placeholder="Search name or mobile"
              onSearch={(q) => {
                setSearch(q);
                setPage(1);
              }}
              className="min-w-0"
            />
          </div>
          <div className="w-full sm:w-44">
            <select
              value={gender}
              onChange={(e) => {
                setGender(e.target.value as Gender | '');
                setPage(1);
              }}
              className={`${filterControlClass} w-full`}
            >
              <option value="">All genders</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <div className="flex h-10 shrink-0 rounded-lg border border-slate-200 bg-slate-50 p-1">
              <button onClick={() => applyPreset('today')} className={presetClass('today')}>
                Today
              </button>
              <button onClick={() => applyPreset('week')} className={presetClass('week')}>
                7 days
              </button>
              <button onClick={() => applyPreset('month')} className={presetClass('month')}>
                30 days
              </button>
            </div>

            <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1">
              <CalendarDays className="h-4 w-4 text-slate-400" />
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                From
                <input
                  type="date"
                  value={registeredFrom}
                  onChange={(e) => {
                    setDatePreset('custom');
                    setRegisteredFrom(e.target.value);
                    setPage(1);
                  }}
                  className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700 focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/10"
                />
              </label>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                To
                <input
                  type="date"
                  value={registeredTo}
                  onChange={(e) => {
                    setDatePreset('custom');
                    setRegisteredTo(e.target.value);
                    setPage(1);
                  }}
                  className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700 focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/10"
                />
              </label>
              {datePreset && (
                <button
                  onClick={clearDateFilter}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-white hover:text-slate-700"
                  title="Clear dates"
                  aria-label="Clear dates"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={8} columns={8} />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={data?.items ?? []}
            searchable={false}
            pageSize={Math.max(data?.items.length ?? 1, 1)}
            showPagination={false}
            emptyMessage="No patients found."
          />
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500">
            <div className="flex items-center gap-3">
              <span>
                Page {page} of {totalPages} · {data?.total ?? 0} total
              </span>
              <label className="flex items-center gap-1.5">
                Rows per page
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page <= 1}
                className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" /> Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                disabled={page >= totalPages}
                className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 disabled:opacity-40"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
