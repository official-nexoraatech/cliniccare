import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { KeyRound, Pencil, Plus, ShieldOff, ShieldCheck } from 'lucide-react';
import type { UserSummary } from '@clinic-care/shared-types';
import { DataTable } from '@/components/DataTable';
import { FormModal } from '@/components/FormModal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PasswordInput } from '@/components/PasswordInput';
import { TableSkeleton } from '@/components/Skeleton';
import { formLabelClass, primaryButtonClass, secondaryButtonClass, standardFieldInputClass } from '@/components/uiStyles';
import { useUserMutations, useUsersQuery } from '@/hooks/useUsers';
import { useRolesQuery } from '@/hooks/useRoles';
import { useAuthStore } from '@/store/auth-store';
import { hasPermission } from '@/lib/permissions';
import { cn, getErrorMessage } from '@/lib/utils';

const NAME_REGEX = /^[A-Za-z ]+$/;
const USERNAME_REGEX = /^[A-Za-z0-9]+$/;
const MOBILE_REGEX = /^(?!(\d)\1{9}$)[6-9]\d{9}$/;

const createUserSchema = z.object({
  name: z.string().min(1, 'Name is required').regex(NAME_REGEX, 'Name can only contain letters and spaces'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .regex(USERNAME_REGEX, 'Username can only contain letters and numbers, no spaces or special characters'),
  mobile: z.union([z.string().regex(MOBILE_REGEX, 'Enter a valid 10-digit mobile number'), z.literal('')]).optional(),
  password: z.string().min(4, 'Password must be at least 4 characters'),
  pin: z.union([z.string().length(4, 'PIN must be exactly 4 digits'), z.literal('')]).optional(),
  role: z.string().min(1, 'Role is required'),
});

type CreateUserFormValues = z.infer<typeof createUserSchema>;

const editUserSchema = z.object({
  name: z.string().min(1, 'Name is required').regex(NAME_REGEX, 'Name can only contain letters and spaces'),
  mobile: z.union([z.string().regex(MOBILE_REGEX, 'Enter a valid 10-digit mobile number'), z.literal('')]).optional(),
  role: z.string().min(1, 'Role is required'),
});

type EditUserFormValues = z.infer<typeof editUserSchema>;

const resetPasswordSchema = z.object({
  newPassword: z.string().min(4, 'Password must be at least 4 characters'),
});

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

const inputClass = standardFieldInputClass;
const labelClass = formLabelClass;

export function UsersPage() {
  const currentUser = useAuthStore((state) => state.user);
  const { data: users, isLoading } = useUsersQuery();
  const { data: roles } = useRolesQuery();
  const { create, update, deactivate, reactivate, resetPassword } = useUserMutations();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<UserSummary | null>(null);
  const [resetTarget, setResetTarget] = useState<UserSummary | null>(null);
  const [editTarget, setEditTarget] = useState<UserSummary | null>(null);

  const addForm = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { role: '' },
  });

  const editForm = useForm<EditUserFormValues>({ resolver: zodResolver(editUserSchema) });

  const resetForm = useForm<ResetPasswordFormValues>({ resolver: zodResolver(resetPasswordSchema) });

  useEffect(() => {
    if (editTarget) {
      editForm.reset({ name: editTarget.name, mobile: editTarget.mobile ?? '', role: editTarget.role });
    }
  }, [editTarget]);

  const activeAdminCount = users?.filter((u) => u.role === 'ADMIN' && u.isActive).length ?? 0;

  const closeAddModal = () => {
    addForm.reset({ role: '' });
    setIsAddOpen(false);
  };

  const closeResetModal = () => {
    resetForm.reset();
    setResetTarget(null);
  };

  const closeEditModal = () => {
    editForm.reset();
    setEditTarget(null);
  };

  const onAddSubmit = async (values: CreateUserFormValues) => {
    try {
      await create.mutateAsync({ ...values, pin: values.pin || undefined, mobile: values.mobile || undefined });
      toast.success(`${values.name} added as ${values.role}`);
      closeAddModal();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not add user.'));
    }
  };

  const onToggleActive = async (user: UserSummary) => {
    try {
      if (user.isActive) {
        await deactivate.mutateAsync(user.id);
        toast.success(`${user.name} deactivated`);
      } else {
        await reactivate.mutateAsync(user.id);
        toast.success(`${user.name} reactivated`);
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not update user status.'));
    } finally {
      setConfirmTarget(null);
    }
  };

  const onEditSubmit = async (values: EditUserFormValues) => {
    if (!editTarget) return;
    try {
      await update.mutateAsync({
        id: editTarget.id,
        payload: { name: values.name, mobile: values.mobile || undefined, role: values.role },
      });
      toast.success(`${values.name} updated`);
      closeEditModal();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not update user.'));
    }
  };

  const onResetSubmit = async (values: ResetPasswordFormValues) => {
    if (!resetTarget) return;
    try {
      await resetPassword.mutateAsync({ id: resetTarget.id, payload: values });
      toast.success(`Password reset for ${resetTarget.name}`);
      resetForm.reset();
      setResetTarget(null);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not reset password.'));
    }
  };

  const canEditUsers = hasPermission(currentUser, 'administration:edit');

  const columns: ColumnDef<UserSummary>[] = [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'username', header: 'Username' },
    {
      accessorKey: 'mobile',
      header: 'Mobile',
      cell: ({ getValue }) => getValue<string | null>() || '-',
    },
    {
      accessorKey: 'role',
      header: 'Role',
      cell: ({ getValue }) => (
        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
          {getValue<string>()}
        </span>
      ),
    },
    {
      accessorKey: 'isActive',
      header: 'Status',
      cell: ({ getValue }) =>
        getValue<boolean>() ? (
          <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
            Active
          </span>
        ) : (
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">
            Inactive
          </span>
        ),
    },
    ...(canEditUsers
      ? [
          {
            id: 'actions',
            header: 'Actions',
            cell: ({ row }: { row: { original: UserSummary } }) => {
              const user = row.original;
              const isOnlyActiveAdmin = user.role === 'ADMIN' && user.isActive && activeAdminCount <= 1;
              return (
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditTarget(user)}
                    className="flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => setResetTarget(user)}
                    className="flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                  >
                    <KeyRound className="h-3.5 w-3.5" /> Reset password
                  </button>
                  <button
                    onClick={() => setConfirmTarget(user)}
                    disabled={isOnlyActiveAdmin}
                    title={isOnlyActiveAdmin ? 'Cannot deactivate the only active admin' : undefined}
                    className={cn(
                      'flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-40',
                      user.isActive
                        ? 'border-red-200 text-red-600 hover:bg-red-50'
                        : 'border-green-200 text-green-600 hover:bg-green-50',
                    )}
                  >
                    {user.isActive ? (
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

  if (!hasPermission(currentUser, 'administration:view')) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white py-20 text-center">
        <h1 className="text-xl font-semibold text-[var(--color-navy)]">Users</h1>
        <p className="mt-2 text-sm text-gray-400">You don't have permission to manage user accounts.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-navy)]">Users</h1>
          <p className="text-sm text-gray-500">Manage who can log in to ClinicCare and what they can do.</p>
        </div>
        {hasPermission(currentUser, 'administration:edit') && (
          <button
            onClick={() => setIsAddOpen(true)}
            className={`flex items-center gap-2 ${primaryButtonClass}`}
          >
            <Plus className="h-4 w-4" /> Add User
          </button>
        )}
      </div>

      {isLoading ? (
        <TableSkeleton rows={6} columns={canEditUsers ? 6 : 5} />
      ) : (
        <DataTable columns={columns} data={users ?? []} searchable emptyMessage="No users yet." />
      )}

      <FormModal
        open={isAddOpen}
        title="Add User"
        onClose={closeAddModal}
        footer={
          <>
            <button
              onClick={closeAddModal}
              className={secondaryButtonClass}
            >
              Cancel
            </button>
            <button
              onClick={addForm.handleSubmit(onAddSubmit)}
              disabled={create.isPending}
              className={primaryButtonClass}
            >
              {create.isPending ? 'Adding...' : 'Add User'}
            </button>
          </>
        }
      >
        <form className="flex flex-col gap-4">
          <div>
            <label className={labelClass}>Name</label>
            <input
              {...addForm.register('name')}
              className={inputClass}
            />
            {addForm.formState.errors.name && (
              <p className="mt-1 text-xs text-red-600">{addForm.formState.errors.name.message}</p>
            )}
          </div>

          <div>
            <label className={labelClass}>Username</label>
            <input
              {...addForm.register('username')}
              className={inputClass}
            />
            {addForm.formState.errors.username && (
              <p className="mt-1 text-xs text-red-600">{addForm.formState.errors.username.message}</p>
            )}
          </div>

          <div>
            <label className={labelClass}>Mobile Number</label>
            <input
              {...addForm.register('mobile')}
              onChange={(e) =>
                addForm.setValue('mobile', e.target.value.replace(/\D/g, ''), { shouldValidate: true })
              }
              inputMode="numeric"
              maxLength={10}
              className={inputClass}
            />
            {addForm.formState.errors.mobile && (
              <p className="mt-1 text-xs text-red-600">{addForm.formState.errors.mobile.message}</p>
            )}
          </div>

          <div>
            <label className={labelClass}>Password</label>
            <PasswordInput {...addForm.register('password')} />
            {addForm.formState.errors.password && (
              <p className="mt-1 text-xs text-red-600">{addForm.formState.errors.password.message}</p>
            )}
          </div>

          <div>
            <label className={labelClass}>PIN (optional, 4 digits)</label>
            <input
              maxLength={4}
              {...addForm.register('pin')}
              className={inputClass}
            />
            {addForm.formState.errors.pin && (
              <p className="mt-1 text-xs text-red-600">{addForm.formState.errors.pin.message}</p>
            )}
          </div>

          <div>
            <label className={labelClass}>Role</label>
            <select
              {...addForm.register('role')}
              defaultValue=""
              className={inputClass}
            >
              <option value="" disabled>
                Select a role
              </option>
              {roles?.map((role) => (
                <option key={role.id} value={role.name}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>
        </form>
      </FormModal>

      <FormModal
        open={Boolean(editTarget)}
        title={`Edit ${editTarget?.name ?? ''}`}
        onClose={closeEditModal}
        footer={
          <>
            <button
              onClick={closeEditModal}
              className={secondaryButtonClass}
            >
              Cancel
            </button>
            <button
              onClick={editForm.handleSubmit(onEditSubmit)}
              disabled={update.isPending}
              className={primaryButtonClass}
            >
              {update.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </>
        }
      >
        <form className="flex flex-col gap-4">
          <div>
            <label className={labelClass}>Name</label>
            <input
              {...editForm.register('name')}
              className={inputClass}
            />
            {editForm.formState.errors.name && (
              <p className="mt-1 text-xs text-red-600">{editForm.formState.errors.name.message}</p>
            )}
          </div>

          <div>
            <label className={labelClass}>Mobile Number</label>
            <input
              {...editForm.register('mobile')}
              onChange={(e) =>
                editForm.setValue('mobile', e.target.value.replace(/\D/g, ''), { shouldValidate: true })
              }
              inputMode="numeric"
              maxLength={10}
              className={inputClass}
            />
            {editForm.formState.errors.mobile && (
              <p className="mt-1 text-xs text-red-600">{editForm.formState.errors.mobile.message}</p>
            )}
          </div>

          <div>
            <label className={labelClass}>Role</label>
            <select
              {...editForm.register('role')}
              className={inputClass}
            >
              {roles?.map((role) => (
                <option key={role.id} value={role.name}>
                  {role.name}
                </option>
              ))}
            </select>
            {editForm.formState.errors.role && (
              <p className="mt-1 text-xs text-red-600">{editForm.formState.errors.role.message}</p>
            )}
          </div>
        </form>
      </FormModal>

      <FormModal
        open={Boolean(resetTarget)}
        title={`Reset password for ${resetTarget?.name ?? ''}`}
        onClose={closeResetModal}
        size="sm"
        footer={
          <>
            <button
              onClick={closeResetModal}
              className={secondaryButtonClass}
            >
              Cancel
            </button>
            <button
              onClick={resetForm.handleSubmit(onResetSubmit)}
              disabled={resetPassword.isPending}
              className={primaryButtonClass}
            >
              {resetPassword.isPending ? 'Saving...' : 'Reset Password'}
            </button>
          </>
        }
      >
        <label className={labelClass}>New password</label>
        <PasswordInput {...resetForm.register('newPassword')} />
        {resetForm.formState.errors.newPassword && (
          <p className="mt-1 text-xs text-red-600">{resetForm.formState.errors.newPassword.message}</p>
        )}
      </FormModal>

      <ConfirmDialog
        open={Boolean(confirmTarget)}
        title={confirmTarget?.isActive ? `Deactivate ${confirmTarget?.name}?` : `Reactivate ${confirmTarget?.name}?`}
        description={
          confirmTarget?.isActive
            ? 'They will no longer be able to log in. This does not delete their history — it can be reversed any time.'
            : 'They will be able to log in again immediately.'
        }
        confirmLabel={confirmTarget?.isActive ? 'Deactivate' : 'Reactivate'}
        destructive={confirmTarget?.isActive}
        onConfirm={() => confirmTarget && onToggleActive(confirmTarget)}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
}
