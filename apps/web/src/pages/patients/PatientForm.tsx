import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Camera } from 'lucide-react';
import { BLOOD_GROUPS, GENDERS, MARITAL_STATUSES } from '@clinic-care/shared-types';
import { usePatientMutations, usePatientQuery } from '@/hooks/usePatients';
import { cn, getErrorMessage } from '@/lib/utils';
import { resolveServerUrl } from '@/lib/api';

const MOBILE_REGEX = /^\d{10}$/;

// Mirrors apps/api/src/modules/patients/dto/create-patient.dto.ts field-for-field —
// frontend and backend must independently reject the same bad input (see feedback_dual_validation).
const patientSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  age: z.coerce.number().int().min(0, 'Age cannot be negative').max(150, 'Age must be 150 or under'),
  dob: z.string().optional().or(z.literal('')),
  gender: z.enum(GENDERS),
  mobile: z.string().regex(MOBILE_REGEX, 'Mobile number must be exactly 10 digits'),
  altMobile: z.union([z.string().regex(MOBILE_REGEX, 'Alternate mobile must be exactly 10 digits'), z.literal('')]).optional(),
  email: z.union([z.string().email('Enter a valid email'), z.literal('')]).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  pincode: z.string().optional(),
  bloodGroup: z.union([z.enum(BLOOD_GROUPS), z.literal('')]).optional(),
  maritalStatus: z.union([z.enum(MARITAL_STATUSES), z.literal('')]).optional(),
  occupation: z.string().optional(),
  allergies: z.string().optional(),
  chronicDiseases: z.string().optional(),
  referredBy: z.string().optional(),
  notes: z.string().optional(),
});

type PatientFormValues = z.infer<typeof patientSchema>;

function calculateAge(dob: string): number {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const hasHadBirthdayThisYear =
    today.getMonth() > birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return Math.max(age, 0);
}

export function PatientForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { data: existing } = usePatientQuery(id);
  const { create, update, uploadPhoto } = usePatientMutations();

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PatientFormValues>({
    resolver: zodResolver(patientSchema),
    defaultValues: { gender: 'MALE' },
  });

  useEffect(() => {
    if (existing) {
      reset({
        name: existing.name,
        age: existing.age,
        dob: existing.dob ? existing.dob.slice(0, 10) : '',
        gender: existing.gender,
        mobile: existing.mobile,
        altMobile: existing.altMobile ?? '',
        email: existing.email ?? '',
        address: existing.address ?? '',
        city: existing.city ?? '',
        pincode: existing.pincode ?? '',
        bloodGroup: (existing.bloodGroup as PatientFormValues['bloodGroup']) ?? '',
        maritalStatus: (existing.maritalStatus as PatientFormValues['maritalStatus']) ?? '',
        occupation: existing.occupation ?? '',
        allergies: existing.allergies ?? '',
        chronicDiseases: existing.chronicDiseases ?? '',
        referredBy: existing.referredBy ?? '',
        notes: existing.notes ?? '',
      });
      if (existing.photoPath) {
        setPhotoPreview(resolveServerUrl(existing.photoPath));
      }
    }
  }, [existing, reset]);

  const dob = watch('dob');
  useEffect(() => {
    if (dob) {
      setValue('age', calculateAge(dob), { shouldValidate: true });
    }
  }, [dob, setValue]);

  const maritalStatus = watch('maritalStatus');
  const bloodGroup = watch('bloodGroup');

  const onPhotoSelected = (file: File | null) => {
    setPhotoFile(file);
    if (file) setPhotoPreview(URL.createObjectURL(file));
  };

  const onSubmit = async (values: PatientFormValues) => {
    const payload = {
      ...values,
      dob: values.dob || undefined,
      altMobile: values.altMobile || undefined,
      email: values.email || undefined,
      maritalStatus: values.maritalStatus || undefined,
      bloodGroup: values.bloodGroup || undefined,
    };

    try {
      let patientId: string;
      if (isEdit && id) {
        await update.mutateAsync({ id, payload });
        patientId = id;
        toast.success('Patient updated');
      } else {
        const result = await create.mutateAsync(payload);
        patientId = result.patient.id;
        if (result.duplicateMobileWarning) {
          toast.warning('Another active patient already uses this mobile number — saved anyway (families often share one).');
        }
        toast.success(`Patient registered as ${result.patient.patientId}`);
      }

      if (photoFile) {
        await uploadPhoto.mutateAsync({ id: patientId, file: photoFile });
      }

      navigate(`/patients/${patientId}`);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not save patient.'));
    }
  };

  const inputClass =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]';
  const labelClass = 'mb-1 block text-sm font-medium text-gray-700';

  return (
    <div className="w-full">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <h1 className="mb-6 text-xl font-semibold text-[var(--color-navy)]">
        {isEdit ? 'Edit Patient' : 'New Patient Registration'}
      </h1>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-gray-300 bg-gray-50 text-gray-400 hover:border-[var(--color-primary)]"
          >
            {photoPreview ? (
              <img src={photoPreview} alt="Patient" className="h-full w-full object-cover" />
            ) : (
              <Camera className="h-6 w-6" />
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => onPhotoSelected(e.target.files?.[0] ?? null)}
          />
          <p className="text-sm text-gray-500">Click to add a photo (optional, JPG/PNG/WEBP)</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Full Name *</label>
            <input {...register('name')} className={inputClass} />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
          </div>

          <div>
            <label className={labelClass}>Gender *</label>
            <select {...register('gender')} className={inputClass}>
              {GENDERS.map((g) => (
                <option key={g} value={g}>
                  {g.charAt(0) + g.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Date of Birth</label>
            <input type="date" {...register('dob')} className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>Age *</label>
            <input type="number" {...register('age')} className={inputClass} />
            {errors.age && <p className="mt-1 text-xs text-red-600">{errors.age.message}</p>}
          </div>

          <div>
            <label className={labelClass}>Mobile Number *</label>
            <input {...register('mobile')} maxLength={10} className={inputClass} placeholder="10 digits" />
            {errors.mobile && <p className="mt-1 text-xs text-red-600">{errors.mobile.message}</p>}
          </div>

          <div>
            <label className={labelClass}>Alternate Mobile</label>
            <input {...register('altMobile')} maxLength={10} className={inputClass} />
            {errors.altMobile && <p className="mt-1 text-xs text-red-600">{errors.altMobile.message}</p>}
          </div>

          <div>
            <label className={labelClass}>Email</label>
            <input {...register('email')} className={inputClass} />
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
          </div>

          <div>
            <label className={labelClass}>Blood Group</label>
            <select
              {...register('bloodGroup')}
              className={cn(inputClass, !bloodGroup && 'text-gray-400')}
            >
              <option value="" className="text-gray-400">
                Not specified
              </option>
              {BLOOD_GROUPS.map((group) => (
                <option key={group} value={group} className="text-gray-900">
                  {group}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className={labelClass}>Address</label>
            <input {...register('address')} className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>City</label>
            <input {...register('city')} className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>Pincode</label>
            <input {...register('pincode')} className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>Marital Status</label>
            <select
              {...register('maritalStatus')}
              className={cn(inputClass, !maritalStatus && 'text-gray-400')}
            >
              <option value="" className="text-gray-400">
                Not specified
              </option>
              {MARITAL_STATUSES.map((status) => (
                <option key={status} value={status} className="text-gray-900">
                  {status.charAt(0) + status.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Occupation</label>
            <input {...register('occupation')} className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>Referred By</label>
            <input {...register('referredBy')} className={inputClass} />
          </div>

          <div className="sm:col-span-2">
            <label className={labelClass}>Allergies</label>
            <input
              {...register('allergies')}
              className={inputClass}
              placeholder="Comma separated, e.g. Penicillin, Peanuts"
            />
          </div>

          <div className="sm:col-span-2">
            <label className={labelClass}>Chronic Diseases</label>
            <input
              {...register('chronicDiseases')}
              className={inputClass}
              placeholder="Comma separated, e.g. Diabetes, Hypertension"
            />
          </div>

          <div className="sm:col-span-2">
            <label className={labelClass}>Notes</label>
            <textarea {...register('notes')} rows={3} className={inputClass} />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-[var(--color-primary)] px-6 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Register Patient'}
          </button>
        </div>
      </form>
    </div>
  );
}
