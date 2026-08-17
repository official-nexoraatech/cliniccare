import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import { BEFORE_AFTER_FOOD_OPTIONS, MEDICINE_FORMS } from '@clinic-care/shared-types';
import type { MedicineFormValues } from '@/lib/medicineSchema';

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]';
const labelClass = 'mb-1 block text-sm font-medium text-gray-700';

const FOOD_LABEL: Record<string, string> = {
  BEFORE_FOOD: 'Before Food',
  AFTER_FOOD: 'After Food',
  WITH_FOOD: 'With Food',
  EMPTY_STOMACH: 'Empty Stomach',
  ANYTIME: 'Anytime',
};

interface MedicineFormFieldsProps {
  register: UseFormRegister<MedicineFormValues>;
  errors: FieldErrors<MedicineFormValues>;
}

export function MedicineFormFields({ register, errors }: MedicineFormFieldsProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Brand Name *</label>
          <input {...register('brandName')} className={inputClass} />
          {errors.brandName && <p className="mt-1 text-xs text-red-600">{errors.brandName.message}</p>}
        </div>

        <div>
          <label className={labelClass}>Generic Name (Salt)</label>
          <input {...register('genericName')} className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>Strength</label>
          <input {...register('strength')} className={inputClass} placeholder="e.g. 500mg" />
        </div>

        <div>
          <label className={labelClass}>Form *</label>
          <select {...register('form')} className={inputClass}>
            {MEDICINE_FORMS.map((form) => (
              <option key={form} value={form}>
                {form.charAt(0) + form.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Company</label>
          <input {...register('company')} className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>Category</label>
          <input {...register('category')} className={inputClass} placeholder="e.g. Antibiotic" />
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 p-4">
        <p className="mb-3 text-sm font-medium text-gray-700">Default Dose (auto-fills the prescription)</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs text-gray-500">Morning</label>
            <input type="number" min={0} max={10} {...register('defaultMorning')} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Afternoon</label>
            <input type="number" min={0} max={10} {...register('defaultAfternoon')} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Evening</label>
            <input type="number" min={0} max={10} {...register('defaultEvening')} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Night</label>
            <input type="number" min={0} max={10} {...register('defaultNight')} className={inputClass} />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-gray-500">Before/After Food</label>
            <select {...register('defaultBeforeAfterFood')} className={inputClass}>
              {BEFORE_AFTER_FOOD_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {FOOD_LABEL[option]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Default Days</label>
            <input
              type="number"
              min={1}
              max={365}
              {...register('defaultDurationDays')}
              className={inputClass}
            />
          </div>
        </div>
      </div>

      <div>
        <label className={labelClass}>Default Dose Text (optional, e.g. "1 tsp")</label>
        <input {...register('defaultDose')} className={inputClass} />
      </div>

      <div>
        <label className={labelClass}>Default Instruction</label>
        <input {...register('defaultInstruction')} className={inputClass} placeholder="e.g. Take with plenty of water" />
      </div>
    </div>
  );
}
