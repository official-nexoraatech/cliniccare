import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { Asterisk, Pencil, Plus, ShieldCheck, ShieldOff } from 'lucide-react';
import { VISIT_FIELD_TYPES, type VisitFieldDefinition } from '@clinic-care/shared-types';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DataTable } from '@/components/DataTable';
import { TableSkeleton } from '@/components/Skeleton';
import { FormModal } from '@/components/FormModal';
import { useVisitFieldMutations, useVisitFieldsQuery } from '@/hooks/useVisitFields';
import { useAuthStore } from '@/store/auth-store';
import { hasPermission } from '@/lib/permissions';
import { cn, getErrorMessage, slugify } from '@/lib/utils';

const KEY_REGEX = /^[a-z][a-z0-9_]*$/;

const FIELD_TYPE_LABEL: Record<(typeof VISIT_FIELD_TYPES)[number], string> = {
  TEXT: 'Text',
  NUMBER: 'Number',
  DATE: 'Date',
  SELECT: 'Dropdown',
  BOOLEAN: 'Yes/No',
};

const visitFieldSchema = z.object({
  key: z.string().min(1, 'Key is required').regex(KEY_REGEX, 'Lowercase letters, numbers, underscores only - must start with a letter'),
  label: z.string().min(1, 'Label is required'),
  fieldType: z.enum(VISIT_FIELD_TYPES),
  optionsText: z.string().optional(),
  required: z.boolean().optional(),
});

type VisitFieldFormValues = z.infer<typeof visitFieldSchema>;

function splitOptions(text: string | undefined): string[] {
  return (text ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

export function VisitFieldsPage() {
  const currentUser = useAuthStore((state) => state.user);
  const canEdit = hasPermission(currentUser, 'visits:edit');
  const { data: fields, isLoading } = useVisitFieldsQuery();
  const { create, update, deactivate, reactivate } = useVisitFieldMutations();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<VisitFieldDefinition | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<VisitFieldDefinition | null>(null);

  const form = useForm<VisitFieldFormValues>({
    resolver: zodResolver(visitFieldSchema),
    defaultValues: { key: '', label: '', fieldType: 'TEXT', optionsText: '', required: false },
  });

  const fieldType = form.watch('fieldType');
  const label = form.watch('label');

  useEffect(() => {
    if (editTarget) return;
    form.setValue('key', slugify(label ?? ''));
  }, [label, editTarget]);

  const openAdd = () => {
    form.reset({ key: '', label: '', fieldType: 'TEXT', optionsText: '', required: false });
    setIsAddOpen(true);
  };

  const openEdit = (field: VisitFieldDefinition) => {
    form.reset({
      key: field.key,
      label: field.label,
      fieldType: field.fieldType,
      optionsText: (field.options ?? []).join(', '),
      required: field.required,
    });
    setEditTarget(field);
  };

  const onSubmit = async (values: VisitFieldFormValues) => {
    const options = values.fieldType === 'SELECT' ? splitOptions(values.optionsText) : undefined;
    if (!editTarget?.isCore && values.fieldType === 'SELECT' && (!options || options.length === 0)) {
      form.setError('optionsText', { message: 'Add at least one option, separated by commas' });
      return;
    }

    try {
      if (editTarget) {
        await update.mutateAsync({
          id: editTarget.id,
          payload: editTarget.isCore
            ? { label: values.label, required: values.required }
            : { label: values.label, fieldType: values.fieldType, options, required: values.required },
        });
        toast.success(`"${values.label}" updated`);
        setEditTarget(null);
      } else {
        await create.mutateAsync({
          key: values.key,
          label: values.label,
          fieldType: values.fieldType,
          options,
          required: values.required,
        });
        toast.success(`"${values.label}" added`);
        setIsAddOpen(false);
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not save field.'));
    }
  };

  const onToggleActive = async (field: VisitFieldDefinition) => {
    try {
      if (field.isActive) {
        await deactivate.mutateAsync(field.id);
        toast.success(`"${field.label}" deactivated`);
      } else {
        await reactivate.mutateAsync(field.id);
        toast.success(`"${field.label}" reactivated`);
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not update field.'));
    } finally {
      setConfirmTarget(null);
    }
  };

  const columns: ColumnDef<VisitFieldDefinition>[] = [
    {
      accessorKey: 'label',
      header: 'Label',
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5">
          {row.original.label}
          {row.original.required && <Asterisk className="h-3 w-3 text-red-500" aria-label="Mandatory" />}
          {row.original.isCore && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">Built-in</span>
          )}
        </span>
      ),
    },
    { accessorKey: 'key', header: 'Key', cell: ({ getValue }) => <code className="text-xs text-gray-500">{getValue<string>()}</code> },
    { accessorKey: 'fieldType', header: 'Type', cell: ({ getValue }) => FIELD_TYPE_LABEL[getValue<VisitFieldDefinition['fieldType']>()] },
    {
      accessorKey: 'required',
      header: 'Mandatory',
      cell: ({ getValue }) =>
        getValue<boolean>() ? (
          <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">Required</span>
        ) : (
          <span className="text-xs text-gray-400">Optional</span>
        ),
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
            cell: ({ row }: { row: { original: VisitFieldDefinition } }) => {
              const field = row.original;
              return (
                <div className="flex gap-2">
                  <button
                    onClick={() => openEdit(field)}
                    className="flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => setConfirmTarget(field)}
                    className={cn(
                      'flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium',
                      field.isActive
                        ? 'border-red-200 text-red-600 hover:bg-red-50'
                        : 'border-green-200 text-green-600 hover:bg-green-50',
                    )}
                  >
                    {field.isActive ? (
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
          <h1 className="text-xl font-semibold text-[var(--color-navy)]">Visit Fields</h1>
          <p className="text-sm text-gray-500">Choose what the consultation form collects, and which fields are mandatory.</p>
        </div>
        {canEdit && (
          <button
            onClick={openAdd}
            className="flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Add Field
          </button>
        )}
      </div>

      {isLoading ? (
        <TableSkeleton rows={6} columns={canEdit ? 6 : 5} />
      ) : (
        <DataTable columns={columns} data={fields ?? []} searchable={false} emptyMessage="No custom fields yet." />
      )}

      <FormModal
        open={isAddOpen || Boolean(editTarget)}
        title={editTarget ? `Edit ${editTarget.label}` : 'Add Visit Field'}
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
            <label className="mb-1 block text-sm font-medium text-gray-700">Label</label>
            <input
              {...form.register('label')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              placeholder="e.g. Pain Score"
            />
            {form.formState.errors.label && <p className="mt-1 text-xs text-red-600">{form.formState.errors.label.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Field Type</label>
            <select
              {...form.register('fieldType')}
              disabled={Boolean(editTarget?.isCore)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] disabled:bg-gray-50 disabled:text-gray-400"
            >
              {VISIT_FIELD_TYPES.map((type) => (
                <option key={type} value={type}>
                  {FIELD_TYPE_LABEL[type]}
                </option>
              ))}
            </select>
            {editTarget?.isCore && (
              <p className="mt-1 text-xs text-gray-400">Built-in field - type matches the real visit record column.</p>
            )}
          </div>

          {fieldType === 'SELECT' && !editTarget?.isCore && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Options</label>
              <input
                {...form.register('optionsText')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                placeholder="Comma separated, e.g. Mild, Moderate, Severe"
              />
              {form.formState.errors.optionsText && <p className="mt-1 text-xs text-red-600">{form.formState.errors.optionsText.message}</p>}
            </div>
          )}

          <label className={cn('flex items-center gap-2 text-sm text-gray-700')}>
            <input
              type="checkbox"
              {...form.register('required')}
              className="h-4 w-4 rounded border-gray-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
            />
            Mandatory - must be provided during consultation
          </label>
        </form>
      </FormModal>

      <ConfirmDialog
        open={Boolean(confirmTarget)}
        title={confirmTarget?.isActive ? `Deactivate "${confirmTarget?.label}"?` : `Reactivate "${confirmTarget?.label}"?`}
        description={
          confirmTarget?.isActive
            ? "It won't show on the consultation form and its required check stops applying. Existing saved values are kept."
            : 'It will show on the consultation form again immediately.'
        }
        confirmLabel={confirmTarget?.isActive ? 'Deactivate' : 'Reactivate'}
        destructive={confirmTarget?.isActive}
        onConfirm={() => confirmTarget && onToggleActive(confirmTarget)}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
}
