import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { Pencil, Plus, Star } from 'lucide-react';
import type { MedicineForm, MedicineSummary } from '@clinic-care/shared-types';
import { MEDICINE_FORMS } from '@clinic-care/shared-types';
import { DataTable } from '@/components/DataTable';
import { TableSkeleton } from '@/components/Skeleton';
import { useMedicineMutations, useMedicinesQuery } from '@/hooks/useMedicines';
import { cn, getErrorMessage } from '@/lib/utils';

export function MedicineListPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<MedicineForm | ''>('');
  const [favouriteOnly, setFavouriteOnly] = useState(false);

  const { data, isLoading } = useMedicinesQuery({
    page: 1,
    pageSize: 100,
    form: form || undefined,
    favouriteOnly: favouriteOnly || undefined,
  });
  const { toggleFavourite } = useMedicineMutations();

  const onToggleFavourite = async (medicine: MedicineSummary) => {
    try {
      await toggleFavourite.mutateAsync(medicine.id);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not update favourite.'));
    }
  };

  const columns = useMemo<ColumnDef<MedicineSummary, any>[]>(
    () => [
      {
        id: 'favourite',
        header: '',
        cell: ({ row }) => (
          <button onClick={() => onToggleFavourite(row.original)} className="text-gray-300 hover:text-amber-400">
            <Star
              className={cn('h-4 w-4', row.original.isFavourite && 'fill-amber-400 text-amber-400')}
            />
          </button>
        ),
      },
      { accessorKey: 'brandName', header: 'Brand' },
      {
        accessorKey: 'genericName',
        header: 'Generic',
        cell: ({ getValue }) => getValue<string | null>() ?? '—',
      },
      {
        accessorKey: 'strength',
        header: 'Strength',
        cell: ({ getValue }) => getValue<string | null>() ?? '—',
      },
      {
        id: 'form',
        header: 'Form',
        accessorFn: (row) => row.form.charAt(0) + row.form.slice(1).toLowerCase(),
      },
      { accessorKey: 'company', header: 'Company', cell: ({ getValue }) => getValue<string | null>() ?? '—' },
      {
        accessorKey: 'defaultDose',
        header: 'Default Dose',
        cell: ({ getValue }) => getValue<string | null>() ?? '—',
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <button
            onClick={() => navigate(`/medicines/${row.original.id}/edit`)}
            className="flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
        ),
      },
    ],
    [navigate],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-navy)]">Medicines</h1>
          <p className="text-sm text-gray-500">{data?.total ?? 0} medicines in the master list</p>
        </div>
        <button
          onClick={() => navigate('/medicines/new')}
          className="flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Add Medicine
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={form}
          onChange={(e) => setForm(e.target.value as MedicineForm | '')}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
        >
          <option value="">All forms</option>
          {MEDICINE_FORMS.map((f) => (
            <option key={f} value={f}>
              {f.charAt(0) + f.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={favouriteOnly}
            onChange={(e) => setFavouriteOnly(e.target.checked)}
            className="rounded border-gray-300"
          />
          Favourites only
        </label>
      </div>

      {isLoading ? (
        <TableSkeleton rows={6} columns={8} />
      ) : (
        <DataTable columns={columns} data={data?.items ?? []} emptyMessage="No medicines found." />
      )}
    </div>
  );
}
