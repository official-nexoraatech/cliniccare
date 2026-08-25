import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Building2, Image as ImageIcon } from 'lucide-react';
import type { UpdateClinicRequest } from '@clinic-care/shared-types';
import { useClinicMutations, useClinicQuery } from '@/hooks/useClinic';
import { useAuthStore } from '@/store/auth-store';
import { hasPermission } from '@/lib/permissions';
import { resolveServerUrl } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import { ConfirmDialog } from '@/components/ConfirmDialog';

const PHONE_REGEX = /^[+]?[\d\s()-]{7,20}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const SLOT_MINUTES_OPTIONS = [10, 15, 20, 30, 60] as const;

// Mirrors apps/api/src/modules/clinic/dto/update-clinic.dto.ts field-for-field
// (see feedback_dual_validation).
const clinicSchema = z.object({
  name: z.string().min(1, 'Clinic name is required'),
  address: z.string().optional(),
  phone: z.string().regex(PHONE_REGEX, 'Enter a valid phone number'),
  email: z.string().email('Enter a valid email'),
  doctorName: z.string().optional(),
  degree: z.string().optional(),
  regnNumber: z.string().optional(),
  openTime: z.string().regex(TIME_REGEX, 'Enter a valid time'),
  closeTime: z.string().regex(TIME_REGEX, 'Enter a valid time'),
  slotMinutes: z.coerce.number().int(),
  taxEnabled: z.boolean(),
  taxLabel: z.string().min(1, 'Tax label is required'),
  gstNumber: z.string().optional(),
  discountEnabled: z.boolean(),
});

type ClinicFormValues = z.infer<typeof clinicSchema>;

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]';
const labelClass = 'mb-1 block text-sm font-medium text-gray-700';

export function ClinicProfilePage() {
  const currentUser = useAuthStore((state) => state.user);
  const { data: clinic, isLoading } = useClinicQuery();
  const { update, uploadLogo, uploadLetterhead } = useClinicMutations();

  const logoInputRef = useRef<HTMLInputElement>(null);
  const letterheadInputRef = useRef<HTMLInputElement>(null);
  const [pendingValues, setPendingValues] = useState<UpdateClinicRequest | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ClinicFormValues>({ resolver: zodResolver(clinicSchema) });
  const taxEnabled = watch('taxEnabled');

  useEffect(() => {
    if (clinic) {
      reset({
        name: clinic.name,
        address: clinic.address ?? '',
        phone: clinic.phone ?? '',
        email: clinic.email ?? '',
        doctorName: clinic.doctorName ?? '',
        degree: clinic.degree ?? '',
        regnNumber: clinic.regnNumber ?? '',
        openTime: clinic.openTime,
        closeTime: clinic.closeTime,
        slotMinutes: clinic.slotMinutes,
        taxEnabled: clinic.taxEnabled,
        taxLabel: clinic.taxLabel,
        gstNumber: clinic.gstNumber ?? '',
        discountEnabled: clinic.discountEnabled,
      });
    }
  }, [clinic, reset]);

  const onSubmit = (values: ClinicFormValues) => {
    setPendingValues({
      name: values.name,
      address: values.address || undefined,
      phone: values.phone,
      email: values.email,
      doctorName: values.doctorName || undefined,
      degree: values.degree || undefined,
      regnNumber: values.regnNumber || undefined,
      openTime: values.openTime,
      closeTime: values.closeTime,
      slotMinutes: values.slotMinutes,
      taxEnabled: values.taxEnabled,
      taxLabel: values.taxLabel,
      gstNumber: values.gstNumber || undefined,
      discountEnabled: values.discountEnabled,
    });
  };

  const confirmSave = async () => {
    if (!pendingValues) return;
    try {
      await update.mutateAsync(pendingValues);
      toast.success('Clinic profile updated');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not update clinic profile.'));
    } finally {
      setPendingValues(null);
    }
  };

  const onImageSelected = async (kind: 'logo' | 'letterhead', file: File | null) => {
    if (!file) return;
    try {
      if (kind === 'logo') {
        await uploadLogo.mutateAsync(file);
      } else {
        await uploadLetterhead.mutateAsync(file);
      }
      toast.success(`${kind === 'logo' ? 'Logo' : 'Letterhead'} updated`);
    } catch (error) {
      toast.error(getErrorMessage(error, `Could not upload ${kind}.`));
    }
  };

  if (!hasPermission(currentUser, 'clinic:edit')) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white py-20 text-center">
        <h1 className="text-xl font-semibold text-[var(--color-navy)]">Clinic Profile</h1>
        <p className="mt-2 text-sm text-gray-400">You don't have permission to update the clinic profile.</p>
      </div>
    );
  }

  if (isLoading || !clinic) {
    return <p className="text-sm text-gray-400">Loading clinic profile...</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-[var(--color-navy)]">Clinic Profile</h1>
        <p className="text-sm text-gray-500">
          This appears on every printed prescription, certificate and bill letterhead.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <p className="mb-3 text-sm font-semibold text-[var(--color-navy)]">Branding</p>
        <div className="flex flex-wrap gap-6">
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-gray-300 bg-gray-50 text-gray-400 hover:border-[var(--color-primary)]"
            >
              {clinic.logoPath ? (
                <img src={resolveServerUrl(clinic.logoPath)} alt="Clinic logo" className="h-full w-full object-cover" />
              ) : (
                <Building2 className="h-6 w-6" />
              )}
            </button>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => onImageSelected('logo', e.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-gray-500">Logo</p>
          </div>

          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => letterheadInputRef.current?.click()}
              className="flex h-20 w-32 items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 text-gray-400 hover:border-[var(--color-primary)]"
            >
              {clinic.letterheadPath ? (
                <img
                  src={resolveServerUrl(clinic.letterheadPath)}
                  alt="Clinic letterhead"
                  className="h-full w-full object-cover"
                />
              ) : (
                <ImageIcon className="h-6 w-6" />
              )}
            </button>
            <input
              ref={letterheadInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => onImageSelected('letterhead', e.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-gray-500">Letterhead</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="mb-3 text-sm font-semibold text-[var(--color-navy)]">Clinic Details</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelClass}>Clinic Name</label>
              <input {...register('name')} className={inputClass} />
              {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Address</label>
              <input {...register('address')} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Phone</label>
              <input {...register('phone')} className={inputClass} />
              {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone.message}</p>}
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input {...register('email')} className={inputClass} />
              {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="mb-3 text-sm font-semibold text-[var(--color-navy)]">Doctor Details (for prescriptions)</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className={labelClass}>Doctor Name</label>
              <input {...register('doctorName')} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Degree</label>
              <input {...register('degree')} placeholder="e.g. MBBS, MD" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Registration No.</label>
              <input {...register('regnNumber')} className={inputClass} />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="mb-3 text-sm font-semibold text-[var(--color-navy)]">Scheduling</p>
          <p className="mb-3 text-xs text-gray-500">
            Drives the booking screen's slot grid — the hours and slot size patients can be booked into.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className={labelClass}>Opens at</label>
              <input type="time" {...register('openTime')} className={inputClass} />
              {errors.openTime && <p className="mt-1 text-xs text-red-600">{errors.openTime.message}</p>}
            </div>
            <div>
              <label className={labelClass}>Closes at</label>
              <input type="time" {...register('closeTime')} className={inputClass} />
              {errors.closeTime && <p className="mt-1 text-xs text-red-600">{errors.closeTime.message}</p>}
            </div>
            <div>
              <label className={labelClass}>Slot length</label>
              <select {...register('slotMinutes')} className={inputClass}>
                {SLOT_MINUTES_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m} minutes
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="mb-3 text-sm font-semibold text-[var(--color-navy)]">Billing</p>
          <p className="mb-3 text-xs text-gray-500">
            Toggle what the bill form shows — a clinic that doesn't charge GST never needs a tax field.
          </p>
          <div className="flex flex-col gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" {...register('discountEnabled')} className="h-4 w-4 rounded border-gray-300" />
              Allow a discount field on bills
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" {...register('taxEnabled')} className="h-4 w-4 rounded border-gray-300" />
              Charge tax (GST) on bills
            </label>
            {taxEnabled && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Tax label</label>
                  <input {...register('taxLabel')} placeholder="GST" className={inputClass} />
                  {errors.taxLabel && <p className="mt-1 text-xs text-red-600">{errors.taxLabel.message}</p>}
                </div>
                <div>
                  <label className={labelClass}>GSTIN (printed on bills)</label>
                  <input {...register('gstNumber')} className={inputClass} />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting || update.isPending}
            className="rounded-lg bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            Save Changes
          </button>
        </div>
      </form>

      <ConfirmDialog
        open={Boolean(pendingValues)}
        title="Save clinic profile changes?"
        description="This updates the letterhead shown on every printed prescription, certificate and bill."
        confirmLabel={update.isPending ? 'Saving...' : 'Save Changes'}
        onConfirm={confirmSave}
        onCancel={() => setPendingValues(null)}
      />
    </div>
  );
}
