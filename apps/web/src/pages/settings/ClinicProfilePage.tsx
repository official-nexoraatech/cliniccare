import { type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useBlocker } from 'react-router-dom';
import {
  Building2,
  CalendarClock,
  FileImage,
  Image as ImageIcon,
  Mail,
  MapPin,
  Phone,
  ReceiptText,
  Save,
  Upload,
  UserRound,
  X,
} from 'lucide-react';
import type { UpdateClinicRequest } from '@clinic-care/shared-types';
import { useClinicMutations, useClinicQuery } from '@/hooks/useClinic';
import { useAuthStore } from '@/store/auth-store';
import { hasPermission } from '@/lib/permissions';
import { resolveServerUrl } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FormSkeleton } from '@/components/Skeleton';

const PHONE_REGEX = /^(?=(?:\D*\d){10,})[+]?[\d\s()-]{7,20}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const NAME_WITH_LETTER_REGEX = /^(?=.*[A-Za-z])[A-Za-z .'-]+$/;
const SLOT_MINUTES_OPTIONS = [10, 15, 20, 30, 60] as const;

// Mirrors apps/api/src/modules/clinic/dto/update-clinic.dto.ts field-for-field
// (see feedback_dual_validation).
const clinicSchema = z.object({
  name: z.string().trim().min(1, 'Clinic name is required'),
  address: z.string().optional(),
  phone: z
    .string()
    .trim()
    .regex(PHONE_REGEX, 'Enter a valid phone number with at least 10 digits'),
  email: z.string().trim().email('Enter a valid email'),
  doctorName: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || NAME_WITH_LETTER_REGEX.test(v), 'Doctor name must contain letters, and only letters, spaces, periods, apostrophes or hyphens'),
  degree: z.string().optional(),
  regnNumber: z.string().optional(),
  openTime: z.string().regex(TIME_REGEX, 'Enter a valid time'),
  closeTime: z.string().regex(TIME_REGEX, 'Enter a valid time'),
  slotMinutes: z.coerce.number().int(),
  taxEnabled: z.boolean(),
  taxLabel: z.string().trim().min(1, 'Tax label is required'),
  gstNumber: z.string().optional(),
  discountEnabled: z.boolean(),
});

type ClinicFormValues = z.infer<typeof clinicSchema>;

const inputClass =
  'h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm shadow-slate-200/40 transition placeholder:text-slate-400 focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/10';
const textareaClass =
  'min-h-24 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm shadow-slate-200/40 transition placeholder:text-slate-400 focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/10';
const labelClass = 'mb-1.5 block text-sm font-semibold text-slate-700';
const sectionClass = 'rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70';
const sectionTitleClass = 'flex items-center gap-2 text-sm font-semibold text-[var(--color-navy)]';
const sectionIconClass = 'h-4 w-4 text-slate-400';
const toggleClass =
  'flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700 transition hover:border-slate-300 hover:bg-white';

const optionalTrimmed = (value?: string) => {
  const trimmed = value?.trim() ?? '';
  return trimmed || undefined;
};

export function ClinicProfilePage() {
  const currentUser = useAuthStore((state) => state.user);
  const { data: clinic, isLoading } = useClinicQuery();
  const { update, uploadLogo, uploadLetterhead } = useClinicMutations();

  const logoInputRef = useRef<HTMLInputElement>(null);
  const letterheadInputRef = useRef<HTMLInputElement>(null);
  const [pendingValues, setPendingValues] = useState<UpdateClinicRequest | null>(null);
  const [previewImage, setPreviewImage] = useState<{ title: string; src: string; wide?: boolean } | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ClinicFormValues>({ resolver: zodResolver(clinicSchema), mode: 'onBlur' });
  const taxEnabled = watch('taxEnabled');
  const [clinicName, doctorName, degree, phone, email, address] = watch([
    'name',
    'doctorName',
    'degree',
    'phone',
    'email',
    'address',
  ]);

  // Blocks in-app navigation (switching Settings tabs, the sidebar, back/forward) while the
  // form has unsaved edits, so a change isn't silently lost by clicking away.
  const blocker = useBlocker(isDirty);

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

  const toUpdateRequest = (values: ClinicFormValues): UpdateClinicRequest => ({
    name: values.name.trim(),
    address: optionalTrimmed(values.address),
    phone: values.phone.trim(),
    email: values.email.trim(),
    doctorName: optionalTrimmed(values.doctorName),
    degree: optionalTrimmed(values.degree),
    regnNumber: optionalTrimmed(values.regnNumber),
    openTime: values.openTime,
    closeTime: values.closeTime,
    slotMinutes: values.slotMinutes,
    taxEnabled: values.taxEnabled,
    taxLabel: values.taxLabel.trim(),
    gstNumber: optionalTrimmed(values.gstNumber),
    discountEnabled: values.discountEnabled,
  });

  const preventEnterSubmit = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key === 'Enter' && event.target instanceof HTMLElement && event.target.tagName !== 'TEXTAREA') {
      event.preventDefault();
    }
  };

  const onSubmit = (values: ClinicFormValues) => {
    setPendingValues(toUpdateRequest(values));
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

  const saveAndLeave = handleSubmit(async (values) => {
    try {
      await update.mutateAsync(toUpdateRequest(values));
      toast.success('Clinic profile updated');
      blocker.proceed?.();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not update clinic profile.'));
    }
  });

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
    return <FormSkeleton sections={3} />;
  }

  const logoUrl = clinic.logoPath ? resolveServerUrl(clinic.logoPath) : null;
  const letterheadUrl = clinic.letterheadPath ? resolveServerUrl(clinic.letterheadPath) : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm shadow-slate-200/70">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-400">Settings</p>
            <h1 className="mt-1 text-2xl font-semibold text-[var(--color-navy)]">Clinic profile</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Printed prescriptions, certificates and bills use these details.
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-500">
            Print setup
          </div>
        </div>
      </div>

      <div className="sticky top-0 z-20 -mx-1 flex flex-wrap items-center justify-between gap-3 bg-[var(--color-bg)]/95 px-1 py-2 backdrop-blur">
        <span className="text-sm font-medium text-slate-500">
          {isDirty ? 'You have unsaved clinic profile changes.' : 'Clinic profile is up to date.'}
        </span>
        <button
          type="submit"
          form="clinic-profile-form"
          disabled={isSubmitting || update.isPending || !isDirty}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 text-sm font-semibold text-white shadow-sm shadow-slate-300 transition hover:-translate-y-0.5 hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/20 focus-visible:ring-offset-2 active:translate-y-0 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {update.isPending ? 'Saving...' : 'Save changes'}
        </button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <aside className="flex flex-col gap-5">

          <section className={sectionClass}>
            <p className={sectionTitleClass}>
              <ImageIcon className={sectionIconClass} />
              Branding
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="flex items-center gap-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
                <button
                  type="button"
                  onClick={() => logoUrl && setPreviewImage({ title: 'Logo', src: logoUrl })}
                  disabled={!logoUrl}
                  className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white bg-white text-slate-400 shadow-sm transition hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/15 disabled:cursor-default disabled:hover:scale-100"
                  title={logoUrl ? 'View logo' : 'No logo uploaded'}
                >
              {logoUrl ? (
                <img src={logoUrl} alt="Clinic logo" className="h-full w-full object-cover" />
              ) : (
                    <Building2 className="h-7 w-7" />
              )}
                </button>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-800">Logo</span>
                  <span className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/15"
                    >
                    <Upload className="h-3.5 w-3.5" />
                    Upload image
                    </button>
                  </span>
                </span>
            </div>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => onImageSelected('logo', e.target.files?.[0] ?? null)}
            />

            <div className="flex items-center gap-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
                <button
                  type="button"
                  onClick={() => letterheadUrl && setPreviewImage({ title: 'Letterhead', src: letterheadUrl, wide: true })}
                  disabled={!letterheadUrl}
                  className="flex h-20 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white bg-white text-slate-400 shadow-sm transition hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/15 disabled:cursor-default disabled:hover:scale-100"
                  title={letterheadUrl ? 'View letterhead' : 'No letterhead uploaded'}
                >
              {letterheadUrl ? (
                <img
                  src={letterheadUrl}
                  alt="Clinic letterhead"
                  className="h-full w-full object-cover"
                />
              ) : (
                    <FileImage className="h-7 w-7" />
              )}
                </button>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-800">Letterhead</span>
                  <span className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => letterheadInputRef.current?.click()}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/15"
                    >
                    <Upload className="h-3.5 w-3.5" />
                    Upload image
                    </button>
                  </span>
                </span>
            </div>
            <input
              ref={letterheadInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => onImageSelected('letterhead', e.target.files?.[0] ?? null)}
            />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
            <p className="mb-4 text-sm font-semibold text-[var(--color-navy)]">Print identity</p>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start gap-3 border-b border-slate-200 pb-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white text-slate-400 shadow-sm">
                  {clinic.logoPath ? (
                    <img src={resolveServerUrl(clinic.logoPath)} alt="Clinic logo preview" className="h-full w-full object-cover" />
                  ) : (
                    <Building2 className="h-6 w-6" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-slate-900">{clinicName || clinic.name}</p>
                  <p className="mt-1 truncate text-xs text-slate-500">{doctorName || clinic.doctorName || 'Doctor name'}</p>
                  <p className="truncate text-xs text-slate-500">{degree || clinic.degree || 'Degree'}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-2 text-xs text-slate-600">
                <span className="inline-flex items-start gap-2">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span>{address || clinic.address || 'Clinic address'}</span>
                </span>
                <span className="inline-flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span>{phone || clinic.phone || 'Phone number'}</span>
                </span>
                <span className="inline-flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span>{email || clinic.email || 'Email address'}</span>
                </span>
              </div>
            </div>
          </section>
        </aside>

        <form id="clinic-profile-form" onSubmit={handleSubmit(onSubmit)} onKeyDown={preventEnterSubmit} className="grid gap-5">
        <section className={sectionClass}>
          <p className={sectionTitleClass}>
            <Building2 className={sectionIconClass} />
            Clinic details
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="lg:col-span-2">
              <label className={labelClass}>Clinic name</label>
              <input {...register('name')} className={inputClass} />
              {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
            </div>
            <div className="lg:col-span-2">
              <label className={labelClass}>Address</label>
              <textarea {...register('address')} className={textareaClass} />
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
        </section>

        <section className={sectionClass}>
          <p className={sectionTitleClass}>
            <UserRound className={sectionIconClass} />
            Doctor details
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div>
              <label className={labelClass}>Doctor name</label>
              <input {...register('doctorName')} className={inputClass} />
              {errors.doctorName && <p className="mt-1 text-xs text-red-600">{errors.doctorName.message}</p>}
            </div>
            <div>
              <label className={labelClass}>Degree</label>
              <input {...register('degree')} placeholder="e.g. MBBS, MD" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Registration no.</label>
              <input {...register('regnNumber')} className={inputClass} />
            </div>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-2">
        <section className={sectionClass}>
          <p className={sectionTitleClass}>
            <CalendarClock className={sectionIconClass} />
            Scheduling
          </p>
          <p className="mb-3 text-xs text-gray-500">
            Drives the booking screen's slot grid — the hours and slot size patients can be booked into.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-1 2xl:grid-cols-3">
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
        </section>

        <section className={sectionClass}>
          <p className={sectionTitleClass}>
            <ReceiptText className={sectionIconClass} />
            Billing
          </p>
          <p className="mb-3 text-xs text-gray-500">
            Toggle what the bill form shows — a clinic that doesn't charge GST never needs a tax field.
          </p>
          <div className="mt-4 flex flex-col gap-3">
            <label className={toggleClass}>
              <input type="checkbox" {...register('discountEnabled')} className="mt-0.5 h-4 w-4 rounded border-slate-300" />
              <span>
                <span className="block font-semibold">Allow discounts</span>
                <span className="mt-0.5 block text-xs text-slate-500">Show discount field on bills</span>
              </span>
            </label>
            <label className={toggleClass}>
              <input type="checkbox" {...register('taxEnabled')} className="mt-0.5 h-4 w-4 rounded border-slate-300" />
              <span>
                <span className="block font-semibold">Charge tax</span>
                <span className="mt-0.5 block text-xs text-slate-500">Enable GST details on bills</span>
              </span>
            </label>
            {taxEnabled && (
              <div className="grid grid-cols-1 gap-4 pt-1 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Tax label</label>
                  <input {...register('taxLabel')} placeholder="GST" className={inputClass} />
                  {errors.taxLabel && <p className="mt-1 text-xs text-red-600">{errors.taxLabel.message}</p>}
                </div>
                <div>
                  <label className={labelClass}>GSTIN</label>
                  <input {...register('gstNumber')} className={inputClass} />
                </div>
              </div>
            )}
          </div>
        </section>
        </div>

      </form>
      </div>

      <ConfirmDialog
        open={Boolean(pendingValues)}
        title="Save clinic profile changes?"
        description="This updates the letterhead shown on every printed prescription, certificate and bill."
        confirmLabel={update.isPending ? 'Saving...' : 'Save Changes'}
        onConfirm={confirmSave}
        onCancel={() => setPendingValues(null)}
      />

      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-4 shadow-2xl shadow-slate-950/20">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-[var(--color-navy)]">{previewImage.title}</h2>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/15"
                aria-label="Close image preview"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex max-h-[72vh] items-center justify-center overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-4">
              <img
                src={previewImage.src}
                alt={`${previewImage.title} preview`}
                className={previewImage.wide ? 'max-h-[64vh] w-full object-contain' : 'max-h-[64vh] max-w-full object-contain'}
              />
            </div>
          </div>
        </div>
      )}

      {blocker.state === 'blocked' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-[var(--color-navy)]">You have unsaved changes</h2>
            <p className="mt-2 text-sm text-gray-600">Save your changes before leaving, or discard them?</p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <button
                onClick={() => blocker.reset?.()}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
              >
                Keep Editing
              </button>
              <button
                onClick={() => blocker.proceed?.()}
                className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                Discard Changes
              </button>
              <button
                onClick={saveAndLeave}
                disabled={isSubmitting || update.isPending}
                className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {update.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
