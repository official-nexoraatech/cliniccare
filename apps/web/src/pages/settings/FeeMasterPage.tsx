import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { Pencil, Plus, ShieldOff, ShieldCheck, Star } from 'lucide-react';
import type { FeeType } from '@clinic-care/shared-types';
import { DataTable } from '@/components/DataTable';
import { FormModal } from '@/components/FormModal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { TableSkeleton } from '@/components/Skeleton';
import { useFeeTypeMutations, useFeeTypesQuery } from '@/hooks/useFeeTypes';
import { useAuthStore } from '@/store/auth-store';
import { hasPermission } from '@/lib/permissions';
import { cn, getErrorMessage } from '@/lib/utils';

const feeTypeSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or fewer'),
  amount: z.coerce.number().int().min(0, 'Amount must be 0 or more').max(10000000, 'Amount must be 1,00,00,000 or less'),
  isDefault: z.boolean().optional(),
});

type FeeTypeFormValues = z.infer<typeof feeTypeSchema>;

export function FeeMasterPage() {
  const currentUser = useAuthStore((state) => state.user);
  const canEdit = hasPermission(currentUser, 'clinic:edit');
  const { data: feeTypes, isLoading } = useFeeTypesQuery();
  const { create, update, deactivate, reactivate } = useFeeTypeMutations();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<FeeType | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<FeeType | null>(null);

  const form = useForm<FeeTypeFormValues>({
    resolver: zodResolver(feeTypeSchema),
    defaultValues: { name: '', amount: 0, isDefault: false },
  });

  const openAdd = () => {
    form.reset({ name: '', amount: 0, isDefault: false });
    setIsAddOpen(true);
  };

  const openEdit = (feeType: FeeType) => {
    form.reset({ name: feeType.name, amount: feeType.amount, isDefault: feeType.isDefault });
    setEditTarget(feeType);
  };

  const onSubmit = async (values: FeeTypeFormValues) => {
    try {
      if (editTarget) {
        await update.mutateAsync({ id: editTarget.id, payload: values });
        toast.success(`"${values.name}" updated`);
        setEditTarget(null);
      } else {
        await create.mutateAsync(values);
        toast.success(`"${values.name}" added`);
        setIsAddOpen(false);
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not save fee type.'));
    }
  };

  const onToggleActive = async (feeType: FeeType) => {
    try {
      if (feeType.isActive) {
        await deactivate.mutateAsync(feeType.id);
        toast.success(`"${feeType.name}" deactivated`);
      } else {
        await reactivate.mutateAsync(feeType.id);
        toast.success(`"${feeType.name}" reactivated`);
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not update fee type.'));
    } finally {
      setConfirmTarget(null);
    }
  };

  const columns: ColumnDef<FeeType>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5">
          {row.original.name}
          {row.original.isDefault && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
        </span>
      ),
    },
    {
      accessorKey: 'amount',
      header: 'Amount',
      cell: ({ getValue }) => `₹${getValue<number>()}`,
    },
    {
      accessorKey: 'isActive',
      header: 'Status',
      cell: ({ getValue }) =>
        getValue<boolean>() ? (
          <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">Active</span>
        ) : (
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">Inactive</span>
        ),
    },
    ...(canEdit
      ? [
          {
            id: 'actions',
            header: 'Actions',
            cell: ({ row }: { row: { original: FeeType } }) => {
              const feeType = row.original;
              return (
                <div className="flex gap-2">
                  <button
                    onClick={() => openEdit(feeType)}
                    className="flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => setConfirmTarget(feeType)}
                    className={cn(
                      'flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium',
                      feeType.isActive
                        ? 'border-red-200 text-red-600 hover:bg-red-50'
                        : 'border-green-200 text-green-600 hover:bg-green-50',
                    )}
                  >
                    {feeType.isActive ? (
                      <>
                        <ShieldOff className="h-3.5 w-3.5" /> Deactivate
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-3.5 w-3.5" /> Reactivate
                      </>
                    )}
                  </button>
                </div>
              );
            },
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-navy)]">Fee Master</h1>
          <p className="text-sm text-gray-500">Consultation and procedure fees used at billing time.</p>
        </div>
        {canEdit && (
          <button
            onClick={openAdd}
            className="flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Add Fee Type
          </button>
        )}
      </div>

      {isLoading ? (
        <TableSkeleton rows={5} columns={canEdit ? 4 : 3} />
      ) : (
        <DataTable columns={columns} data={feeTypes ?? []} searchable={false} emptyMessage="No fee types yet." />
      )}

      <FormModal
        open={isAddOpen || Boolean(editTarget)}
        title={editTarget ? `Edit ${editTarget.name}` : 'Add Fee Type'}
        size="sm"
        onClose={() => {
          setIsAddOpen(false);
          setEditTarget(null);
        }}
        footer={
          <>
            <button
              onClick={() => {
                setIsAddOpen(false);
                setEditTarget(null);
              }}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={form.handleSubmit(onSubmit)}
              disabled={create.isPending || update.isPending}
              className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {create.isPending || update.isPending ? 'Saving...' : 'Save'}
            </button>
          </>
        }
      >
        <form className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Name</label>
            <input
              {...form.register('name')}
              maxLength={100}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            />
            {form.formState.errors.name && (
              <p className="mt-1 text-xs text-red-600">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Amount (₹)</label>
            <input
              type="number"
              max={10000000}
              {...form.register('amount')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            />
            {form.formState.errors.amount && (
              <p className="mt-1 text-xs text-red-600">{form.formState.errors.amount.message}</p>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              {...form.register('isDefault')}
              className="h-4 w-4 rounded border-gray-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
            />
            Default fee type
          </label>
        </form>
      </FormModal>

      <ConfirmDialog
        open={Boolean(confirmTarget)}
        title={confirmTarget?.isActive ? `Deactivate "${confirmTarget?.name}"?` : `Reactivate "${confirmTarget?.name}"?`}
        description={
          confirmTarget?.isActive
            ? "It won't be offered when billing new visits. This can be reversed any time."
            : 'It will be offered when billing again immediately.'
        }
        confirmLabel={confirmTarget?.isActive ? 'Deactivate' : 'Reactivate'}
        destructive={confirmTarget?.isActive}
        onConfirm={() => confirmTarget && onToggleActive(confirmTarget)}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
}
