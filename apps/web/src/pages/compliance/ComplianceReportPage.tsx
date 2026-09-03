import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { Download, Eye } from 'lucide-react';
import type { ComplianceGrade, ComplianceReportRow } from '@clinic-care/shared-types';
import { COMPLIANCE_GRADES } from '@clinic-care/shared-types';
import { DataTable } from '@/components/DataTable';
import { ComplianceBadge } from '@/components/ComplianceBadge';
import { TableSkeleton } from '@/components/Skeleton';
import { useComplianceReportQuery } from '@/hooks/useCompliance';
import { downloadCsv } from '@/lib/csv';

export function ComplianceReportPage() {
  const navigate = useNavigate();
  const [grade, setGrade] = useState<ComplianceGrade | ''>('');
  const { data, isLoading } = useComplianceReportQuery(grade || undefined);

  const columns: ColumnDef<ComplianceReportRow>[] = [
    { accessorKey: 'patientName', header: 'Patient' },
    { accessorKey: 'patientMobile', header: 'Mobile' },
    {
      id: 'compliance',
      header: 'Latest Compliance',
      cell: ({ row }) => (
        <ComplianceBadge percent={row.original.latestPercent} grade={row.original.latestGrade} />
      ),
    },
    {
      accessorKey: 'recordedOn',
      header: 'Recorded On',
      cell: ({ getValue }) => new Date(getValue<string>()).toLocaleDateString('en-IN'),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <button
          onClick={() => navigate(`/patients/${row.original.patientId}`)}
          className="flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
        >
          <Eye className="h-3.5 w-3.5" /> View Patient
        </button>
      ),
    },
  ];

  const handleExport = () => {
    if (!data) return;
    downloadCsv(
      `compliance-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Patient', 'Mobile', 'Compliance %', 'Grade', 'Recorded On'],
      data.map((r) => [r.patientName, r.patientMobile, r.latestPercent, r.latestGrade, r.recordedOn]),
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-navy)]">Compliance Report</h1>
          <p className="text-sm text-gray-500">Each patient's most recent recorded compliance %.</p>
        </div>
        <button
          onClick={handleExport}
          disabled={!data?.length}
          className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
        >
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setGrade('')}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
            grade === '' ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white' : 'border-gray-300 text-gray-600'
          }`}
        >
          All
        </button>
        {COMPLIANCE_GRADES.map((g) => (
          <button
            key={g}
            onClick={() => setGrade(g)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
              grade === g ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white' : 'border-gray-300 text-gray-600'
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      {isLoading ? (
        <TableSkeleton rows={6} columns={5} />
      ) : (
        <DataTable columns={columns} data={data ?? []} emptyMessage="No compliance records yet." />
      )}
    </div>
  );
}
