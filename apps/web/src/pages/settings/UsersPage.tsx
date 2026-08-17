import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { KeyRound, Plus, ShieldOff, ShieldCheck } from 'lucide-react';
import { ROLES, type UserSummary } from '@clinic-care/shared-types';
import { DataTable } from '@/components/DataTable';
import { FormModal } from '@/components/FormModal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useUserMutations, useUsersQuery } from '@/hooks/useUsers';
import { useAuthStore } from '@/store/auth-store';
import { getErrorMessage } from '@/lib/utils';

const createUserSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(4, 'Password must be at least 4 characters'),
  pin: z.union([z.string().length(4, 'PIN must be exactly 4 digits'), z.literal('')]).optional(),
  role: z.enum(ROLES),
});

type CreateUserFormValues = z.infer<typeof createUserSchema>;

const resetPasswordSchema = z.object({
  newPassword: z.string().min(4, 'Password must be at least 4 characters'),
});

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export function UsersPage() {
  const currentUser = useAuthStore((state) => state.user);
  const { data: users, isLoading } = useUsersQuery();
  const { create, deactivate, reactivate, resetPassword } = useUserMutations();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<UserSummary | null>(null);
  const [resetTarget, setResetTarget] = useState<UserSummary | null>(null);

  const addForm = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { role: 'RECEPTIONIST' },
  });

  const resetForm = useForm<ResetPasswordFormValues>({ resolver: zodResolver(resetPasswordSchema) });

  const activeAdminCount = users?.filter((u) => u.role === 'ADMIN' && u.isActive).length ?? 0;

  const onAddSubmit = async (values: CreateUserFormValues) => {
    try {
      await create.mutateAsync({ ...values, pin: values.pin || undefined });
      toast.success(`${values.name} added as ${values.role}`);
      addForm.reset({ role: 'RECEPTIONIST' });
      setIsAddOpen(false);
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

  const columns: ColumnDef<UserSummary>[] = [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'username', header: 'Username' },
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
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const user = row.original;
        const isOnlyActiveAdmin = user.role === 'ADMIN' && user.isActive && activeAdminCount <= 1;
        return (
          <div className="flex gap-2">
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
              className="flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
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
  ];

  if (currentUser && currentUser.role !== 'ADMIN') {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white py-20 text-center">
        <h1 className="text-xl font-semibold text-[var(--color-navy)]">Users</h1>
        <p className="mt-2 text-sm text-gray-400">Only Admin can manage user accounts.</p>
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
        <button
          onClick={() => setIsAddOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Add User
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400">Loading users...</p>
      ) : (
        <DataTable columns={columns} data={users ?? []} searchable emptyMessage="No users yet." />
      )}

      <FormModal
        open={isAddOpen}
        title="Add User"
        onClose={() => setIsAddOpen(false)}
        footer={
          <>
            <button
              onClick={() => setIsAddOpen(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={addForm.handleSubmit(onAddSubmit)}
              disabled={create.isPending}
              className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {create.isPending ? 'Adding...' : 'Add User'}
            </button>
          </>
        }
      >
        <form className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Name</label>
            <input
              {...addForm.register('name')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            />
            {addForm.formState.errors.name && (
              <p className="mt-1 text-xs text-red-600">{addForm.formState.errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Username</label>
            <input
              {...addForm.register('username')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            />
            {addForm.formState.errors.username && (
              <p className="mt-1 text-xs text-red-600">{addForm.formState.errors.username.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              {...addForm.register('password')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            />
            {addForm.formState.errors.password && (
              <p className="mt-1 text-xs text-red-600">{addForm.formState.errors.password.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">PIN (optional, 4 digits)</label>
            <input
              maxLength={4}
              {...addForm.register('pin')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            />
            {addForm.formState.errors.pin && (
              <p className="mt-1 text-xs text-red-600">{addForm.formState.errors.pin.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Role</label>
            <select
              {...addForm.register('role')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            >
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>
        </form>
      </FormModal>

      <FormModal
        open={Boolean(resetTarget)}
        title={`Reset password for ${resetTarget?.name ?? ''}`}
        onClose={() => setResetTarget(null)}
        size="sm"
        footer={
          <>
            <button
              onClick={() => setResetTarget(null)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={resetForm.handleSubmit(onResetSubmit)}
              disabled={resetPassword.isPending}
              className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {resetPassword.isPending ? 'Saving...' : 'Reset Password'}
            </button>
          </>
        }
      >
        <label className="mb-1 block text-sm font-medium text-gray-700">New password</label>
        <input
          type="password"
          {...resetForm.register('newPassword')}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
        />
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
