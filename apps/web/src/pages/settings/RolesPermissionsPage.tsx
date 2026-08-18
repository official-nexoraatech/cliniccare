import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Lock, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  PERMISSION_ACTIONS,
  PERMISSION_MODULES,
  type PermissionAction,
  type PermissionKey,
  type PermissionModule,
  type RoleSummary,
} from '@clinic-care/shared-types';
import { FormModal } from '@/components/FormModal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useRoleMutations, useRolesQuery } from '@/hooks/useRoles';
import { getErrorMessage } from '@/lib/utils';

const MODULE_LABELS: Record<PermissionModule, string> = {
  patients: 'Patients',
  visits: 'Visits / Consultation',
  prescriptions: 'Prescriptions',
  medicines: 'Medicines',
  clinic: 'Clinic Settings',
  administration: 'Users & Roles',
};

const ACTION_LABELS: Record<PermissionAction, string> = {
  view: 'View',
  edit: 'Edit',
};

function key(mod: PermissionModule, action: PermissionAction): PermissionKey {
  return `${mod}:${action}`;
}

function PermissionMatrix({
  value,
  onChange,
  disabled,
}: {
  value: Set<PermissionKey>;
  onChange: (next: Set<PermissionKey>) => void;
  disabled?: boolean;
}) {
  const toggle = (k: PermissionKey) => {
    const next = new Set(value);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    onChange(next);
  };

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
          <th className="py-2">Module</th>
          {PERMISSION_ACTIONS.map((action) => (
            <th key={action} className="py-2 text-center">
              {ACTION_LABELS[action]}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {PERMISSION_MODULES.map((mod) => (
          <tr key={mod}>
            <td className="py-2.5 font-medium text-gray-700">{MODULE_LABELS[mod]}</td>
            {PERMISSION_ACTIONS.map((action) => (
              <td key={action} className="py-2.5 text-center">
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={value.has(key(mod, action))}
                  onChange={() => toggle(key(mod, action))}
                  className="h-4 w-4 rounded border-gray-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)] disabled:opacity-40"
                />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function RolesPermissionsPage() {
  const { data: roles, isLoading } = useRolesQuery();
  const { create, update, remove } = useRoleMutations();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPermissions, setNewPermissions] = useState<Set<PermissionKey>>(new Set());

  const [editTarget, setEditTarget] = useState<RoleSummary | null>(null);
  const [editName, setEditName] = useState('');
  const [editPermissions, setEditPermissions] = useState<Set<PermissionKey>>(new Set());

  const [deleteTarget, setDeleteTarget] = useState<RoleSummary | null>(null);

  useEffect(() => {
    if (editTarget) {
      setEditName(editTarget.name);
      setEditPermissions(new Set(editTarget.permissions));
    }
  }, [editTarget]);

  const onCreate = async () => {
    if (!newName.trim()) {
      toast.error('Role name is required.');
      return;
    }
    try {
      await create.mutateAsync({ name: newName.trim(), permissions: [...newPermissions] });
      toast.success(`Role "${newName.trim()}" created`);
      setNewName('');
      setNewPermissions(new Set());
      setIsAddOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not create role.'));
    }
  };

  const onSaveEdit = async () => {
    if (!editTarget) return;
    try {
      await update.mutateAsync({
        id: editTarget.id,
        payload: { name: editName.trim(), permissions: [...editPermissions] },
      });
      toast.success(`Role "${editName.trim()}" updated`);
      setEditTarget(null);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not update role.'));
    }
  };

  const onDelete = async () => {
    if (!deleteTarget) return;
    try {
      await remove.mutateAsync(deleteTarget.id);
      toast.success(`Role "${deleteTarget.name}" deleted`);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not delete role.'));
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-navy)]">Roles & Permissions</h1>
          <p className="text-sm text-gray-500">Decide exactly what each role can see and change.</p>
        </div>
        <button
          onClick={() => setIsAddOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Add Role
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400">Loading roles...</p>
      ) : (
        <div className="flex flex-col gap-3">
          {roles?.map((role) => (
            <div key={role.id} className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-2">
                <span className="font-medium text-[var(--color-navy)]">{role.name}</span>
                {role.isLocked && (
                  <span title="Locked">
                    <Lock className="h-3.5 w-3.5 text-gray-400" />
                  </span>
                )}
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                  {role.userCount} user{role.userCount === 1 ? '' : 's'}
                </span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                  {role.permissions.length} permission{role.permissions.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditTarget(role)}
                  disabled={role.isLocked}
                  title={role.isLocked ? 'This role is locked' : undefined}
                  className="flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
                <button
                  onClick={() => setDeleteTarget(role)}
                  disabled={role.isLocked || role.userCount > 0}
                  title={
                    role.isLocked
                      ? 'This role is locked'
                      : role.userCount > 0
                        ? 'Reassign its users before deleting'
                        : undefined
                  }
                  className="flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:text-gray-400"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <FormModal
        open={isAddOpen}
        title="Add Role"
        size="lg"
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
              onClick={onCreate}
              disabled={create.isPending}
              className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {create.isPending ? 'Creating...' : 'Create Role'}
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Role name</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Nurse"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            />
          </div>
          <PermissionMatrix value={newPermissions} onChange={setNewPermissions} />
        </div>
      </FormModal>

      <FormModal
        open={Boolean(editTarget)}
        title={`Edit ${editTarget?.name ?? ''}`}
        size="lg"
        onClose={() => setEditTarget(null)}
        footer={
          <>
            <button
              onClick={() => setEditTarget(null)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={onSaveEdit}
              disabled={update.isPending}
              className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {update.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Role name</label>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            />
          </div>
          <PermissionMatrix value={editPermissions} onChange={setEditPermissions} />
        </div>
      </FormModal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={`Delete ${deleteTarget?.name}?`}
        description="This cannot be undone. Only possible when no user is assigned to this role."
        confirmLabel="Delete"
        destructive
        onConfirm={onDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
