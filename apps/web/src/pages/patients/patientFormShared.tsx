import { z } from 'zod';
import type { ChangeEvent } from 'react';
import type { UseFormRegister, FieldErrors, UseFormWatch, UseFormSetValue } from 'react-hook-form';
import {
  BLOOD_GROUPS,
  GENDERS,
  MARITAL_STATUSES,
  type PatientCustomFieldValues,
  type PatientFieldDefinition,
} from '@clinic-care/shared-types';
import { formLabelClass, standardFieldInputClass } from '@/components/uiStyles';
import { cn } from '@/lib/utils';

export const MOBILE_REGEX = /^(?!(\d)\1{9}$)[6-9]\d{9}$/;
const NAME_REGEX = /^[A-Za-z ]+$/;
const PINCODE_REGEX = /^[1-9]\d{5}$/;

function isTodayOrPast(value: string) {
  if (!value) return true;
  const selected = new Date(`${value}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return selected <= today;
}

// Format validators mirror apps/api/src/modules/patients/dto/create-patient.dto.ts —
// frontend and backend must independently reject the same bad input (see
// feedback_dual_validation). Presence is deliberately NOT enforced here: which
// fields are actually mandatory is decided at runtime by Settings → Patient
// Fields (see validateCustomFields, called against both core and custom defs).
export const patientSchema = z.object({
  name: z.union([
    z.string().trim().regex(NAME_REGEX, 'Name can only contain letters and spaces'),
    z.literal(''),
  ]).optional(),
  age: z.number().int().min(0, 'Age cannot be negative').max(150, 'Age must be 150 or under').optional(),
  dob: z.string().refine(isTodayOrPast, 'Date of birth cannot be in the future').optional().or(z.literal('')),
  gender: z.enum(GENDERS).optional(),
  mobile: z.union([z.string().regex(MOBILE_REGEX, 'Enter a valid 10-digit mobile number'), z.literal('')]).optional(),
  altMobile: z.union([z.string().regex(MOBILE_REGEX, 'Enter a valid 10-digit alternate mobile number'), z.literal('')]).optional(),
  email: z.union([z.string().email('Enter a valid email'), z.literal('')]).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  pincode: z.union([z.string().regex(PINCODE_REGEX, 'Pincode must be a valid 6 digit Indian pincode'), z.literal('')]).optional(),
  bloodGroup: z.union([z.enum(BLOOD_GROUPS), z.literal('')]).optional(),
  maritalStatus: z.union([z.enum(MARITAL_STATUSES), z.literal('')]).optional(),
  occupation: z.string().optional(),
  allergies: z.string().optional(),
  chronicDiseases: z.string().optional(),
  stage: z.string().optional(),
  referredBy: z.string().optional(),
  notes: z.string().optional(),
});

export type PatientFormValues = z.infer<typeof patientSchema>;

export function calculateAge(dob: string): number {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const hasHadBirthdayThisYear =
    today.getMonth() > birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return Math.max(age, 0);
}

const inputClass = standardFieldInputClass;
const labelClass = formLabelClass;

interface PatientFormFieldsProps {
  register: UseFormRegister<PatientFormValues>;
  errors: FieldErrors<PatientFormValues>;
  watch: UseFormWatch<PatientFormValues>;
  setValue: UseFormSetValue<PatientFormValues>;
  /** The isCore rows from Settings → Patient Fields — controls which built-in fields render and whether each shows as required. Missing/loading defaults to "visible, optional" so the form never goes blank. */
  coreFieldDefs?: PatientFieldDefinition[];
}

export function PatientFormFields({ register, errors, watch, setValue, coreFieldDefs }: PatientFormFieldsProps) {
  const maritalStatus = watch('maritalStatus');
  const bloodGroup = watch('bloodGroup');

  const corePolicy = new Map((coreFieldDefs ?? []).map((d) => [d.key, d]));
  const isActive = (key: string) => corePolicy.get(key)?.isActive ?? true;
  const isRequired = (key: string) => corePolicy.get(key)?.required ?? false;
  const today = new Date().toISOString().slice(0, 10);
  const stripNonDigits = (key: 'mobile' | 'altMobile') => (e: ChangeEvent<HTMLInputElement>) =>
    setValue(key, e.target.value.replace(/\D/g, ''), { shouldValidate: true });

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {isActive('name') && (
        <div>
          <label className={labelClass}>Full Name {isRequired('name') && '*'}</label>
          <input {...register('name')} className={inputClass} />
          {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
        </div>
      )}

      {isActive('gender') && (
        <div>
          <label className={labelClass}>Gender {isRequired('gender') && '*'}</label>
          <select {...register('gender')} className={inputClass}>
            {GENDERS.filter((g) => g !== 'UNSPECIFIED').map((g) => (
              <option key={g} value={g}>
                {g.charAt(0) + g.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </div>
      )}

      {isActive('dob') && (
        <div>
          <label className={labelClass}>Date of Birth {isRequired('dob') && '*'}</label>
          <input type="date" max={today} {...register('dob')} className={inputClass} />
          {errors.dob && <p className="mt-1 text-xs text-red-600">{errors.dob.message}</p>}
        </div>
      )}

      {isActive('age') && (
        <div>
          <label className={labelClass}>Age {isRequired('age') && '*'}</label>
          <input
            type="number"
            {...register('age', { setValueAs: (value) => (value === '' ? undefined : Number(value)) })}
            className={inputClass}
          />
          {errors.age && <p className="mt-1 text-xs text-red-600">{errors.age.message}</p>}
        </div>
      )}

      {isActive('mobile') && (
        <div>
          <label className={labelClass}>Mobile Number {isRequired('mobile') && '*'}</label>
          <input
            {...register('mobile')}
            onChange={stripNonDigits('mobile')}
            inputMode="numeric"
            maxLength={10}
            className={inputClass}
            placeholder="10 digits"
          />
          {errors.mobile && <p className="mt-1 text-xs text-red-600">{errors.mobile.message}</p>}
        </div>
      )}

      {isActive('altMobile') && (
        <div>
          <label className={labelClass}>Alternate Mobile {isRequired('altMobile') && '*'}</label>
          <input
            {...register('altMobile')}
            onChange={stripNonDigits('altMobile')}
            inputMode="numeric"
            maxLength={10}
            className={inputClass}
          />
          {errors.altMobile && <p className="mt-1 text-xs text-red-600">{errors.altMobile.message}</p>}
        </div>
      )}

      {isActive('email') && (
        <div>
          <label className={labelClass}>Email {isRequired('email') && '*'}</label>
          <input {...register('email')} className={inputClass} />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
        </div>
      )}

      {isActive('bloodGroup') && (
        <div>
          <label className={labelClass}>Blood Group {isRequired('bloodGroup') && '*'}</label>
          <select {...register('bloodGroup')} className={cn(inputClass, !bloodGroup && 'text-gray-400')}>
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
      )}

      {isActive('address') && (
        <div className="sm:col-span-2">
          <label className={labelClass}>Address {isRequired('address') && '*'}</label>
          <input {...register('address')} className={inputClass} />
          {errors.address && <p className="mt-1 text-xs text-red-600">{errors.address.message}</p>}
        </div>
      )}

      {isActive('city') && (
        <div>
          <label className={labelClass}>City {isRequired('city') && '*'}</label>
          <input {...register('city')} className={inputClass} />
        </div>
      )}

      {isActive('pincode') && (
        <div>
          <label className={labelClass}>Pincode {isRequired('pincode') && '*'}</label>
          <input {...register('pincode')} inputMode="numeric" maxLength={6} className={inputClass} />
          {errors.pincode && <p className="mt-1 text-xs text-red-600">{errors.pincode.message}</p>}
        </div>
      )}

      {isActive('maritalStatus') && (
        <div>
          <label className={labelClass}>Marital Status {isRequired('maritalStatus') && '*'}</label>
          <select {...register('maritalStatus')} className={cn(inputClass, !maritalStatus && 'text-gray-400')}>
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
      )}

      {isActive('occupation') && (
        <div>
          <label className={labelClass}>Occupation {isRequired('occupation') && '*'}</label>
          <input {...register('occupation')} className={inputClass} />
        </div>
      )}

      {isActive('referredBy') && (
        <div>
          <label className={labelClass}>Referred By {isRequired('referredBy') && '*'}</label>
          <input {...register('referredBy')} className={inputClass} />
        </div>
      )}

      {isActive('stage') && (
        <div>
          <label className={labelClass}>Stage {isRequired('stage') && '*'}</label>
          <input {...register('stage')} className={inputClass} placeholder="e.g. Stage 2, Post-op recovery" />
          {errors.stage && <p className="mt-1 text-xs text-red-600">{errors.stage.message}</p>}
        </div>
      )}

      {isActive('allergies') && (
        <div className="sm:col-span-2">
          <label className={labelClass}>Allergies {isRequired('allergies') && '*'}</label>
          <input
            {...register('allergies')}
            className={inputClass}
            placeholder="Comma separated, e.g. Penicillin, Peanuts"
          />
        </div>
      )}

      {isActive('chronicDiseases') && (
        <div className="sm:col-span-2">
          <label className={labelClass}>Diseases / Conditions {isRequired('chronicDiseases') && '*'}</label>
          <input
            {...register('chronicDiseases')}
            className={inputClass}
            placeholder="Comma separated, e.g. Diabetes, Hypertension, or None"
          />
          {errors.chronicDiseases && <p className="mt-1 text-xs text-red-600">{errors.chronicDiseases.message}</p>}
        </div>
      )}

      {isActive('notes') && (
        <div className="sm:col-span-2">
          <label className={labelClass}>Notes {isRequired('notes') && '*'}</label>
          <textarea {...register('notes')} rows={3} className={inputClass} />
        </div>
      )}
    </div>
  );
}

/** Required-field check for the admin-configured fields (Settings → Patient Fields); ignores inactive ones. */
export function validateCustomFields(
  fields: PatientFieldDefinition[],
  values: Record<string, unknown>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    if (!field.isActive) continue;

    const value = String(values[field.key] ?? '').trim();
    if (field.required && !value) {
      errors[field.key] = `${field.label} is required`;
      continue;
    }
    if (!value) continue;

    if (field.fieldType === 'NUMBER' && !Number.isFinite(Number(value))) {
      errors[field.key] = `${field.label} must be a valid number`;
    }
    if (field.fieldType === 'DATE' && Number.isNaN(new Date(`${value}T00:00:00`).getTime())) {
      errors[field.key] = `${field.label} must be a valid date`;
    }
    if (field.fieldType === 'SELECT' && field.options?.length && !field.options.includes(value)) {
      errors[field.key] = `${field.label} must be one of the configured options`;
    }
    if (field.fieldType === 'BOOLEAN' && value !== 'true' && value !== 'false') {
      errors[field.key] = `${field.label} must be checked or unchecked`;
    }
  }
  return errors;
}

interface PatientCustomFieldsProps {
  fields: PatientFieldDefinition[];
  values: PatientCustomFieldValues;
  onChange: (key: string, value: string) => void;
  errors?: Record<string, string>;
}

/** Renders whatever fields the admin has switched on in Settings → Patient Fields, in their configured order. */
export function PatientCustomFields({ fields, values, onChange, errors }: PatientCustomFieldsProps) {
  const activeFields = fields.filter((f) => f.isActive);
  if (activeFields.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {activeFields.map((field) => {
        const value = values[field.key] ?? '';
        const error = errors?.[field.key];

        return (
          <div key={field.id} className={field.fieldType === 'BOOLEAN' ? 'flex items-end' : undefined}>
            {field.fieldType === 'BOOLEAN' ? (
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={value === 'true'}
                  onChange={(e) => onChange(field.key, e.target.checked ? 'true' : 'false')}
                  className="h-4 w-4 rounded border-gray-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                />
                {field.label} {field.required && '*'}
              </label>
            ) : (
              <>
                <label className={labelClass}>
                  {field.label} {field.required && '*'}
                </label>
                {field.fieldType === 'SELECT' ? (
                  <select value={value} onChange={(e) => onChange(field.key, e.target.value)} className={inputClass}>
                    <option value="">Not specified</option>
                    {(field.options ?? []).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.fieldType === 'NUMBER' ? 'number' : field.fieldType === 'DATE' ? 'date' : 'text'}
                    value={value}
                    onChange={(e) => onChange(field.key, e.target.value)}
                    className={inputClass}
                  />
                )}
              </>
            )}
            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
          </div>
        );
      })}
    </div>
  );
}
