import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import { BEFORE_AFTER_FOOD_OPTIONS, MEDICINE_FORMS, type MedicineFieldDefinition } from '@clinic-care/shared-types';
import type { MedicineFormValues } from '@/lib/medicineSchema';
import { formLabelClass, sectionCardClass, standardFieldInputClass } from '@/components/uiStyles';

const inputClass = standardFieldInputClass;
const labelClass = formLabelClass;
const sectionClass = sectionCardClass;
const sectionTitleClass = 'text-base font-semibold text-[var(--color-navy)]';
const sectionGridClass = 'mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4';

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
  /** The isCore rows from Settings → Medicine Fields — controls which built-in fields render and whether each shows as required. Missing/loading defaults to "visible, optional" so the form never goes blank. */
  coreFieldDefs?: MedicineFieldDefinition[];
}

export function MedicineFormFields({ register, errors, coreFieldDefs }: MedicineFormFieldsProps) {
  const corePolicy = new Map((coreFieldDefs ?? []).map((d) => [d.key, d]));
  const isActive = (key: string) => corePolicy.get(key)?.isActive ?? true;
  const isRequired = (key: string) => corePolicy.get(key)?.required ?? false;

  return (
    <div className="flex flex-col gap-5">
      <section className={sectionClass}>
        <h2 className={sectionTitleClass}>Medicine details</h2>
        <div className={sectionGridClass}>
          {isActive('brandName') && (
            <div className="xl:col-span-2">
              <label className={labelClass}>Brand name {isRequired('brandName') && '*'}</label>
              <input {...register('brandName')} className={inputClass} />
              {errors.brandName && <p className="mt-1 text-xs text-red-600">{errors.brandName.message}</p>}
            </div>
          )}

          {isActive('genericName') && (
            <div className="xl:col-span-2">
              <label className={labelClass}>Generic name (salt) {isRequired('genericName') && '*'}</label>
              <input {...register('genericName')} className={inputClass} />
            </div>
          )}

          {isActive('strength') && (
            <div>
              <label className={labelClass}>Strength {isRequired('strength') && '*'}</label>
              <input {...register('strength')} className={inputClass} placeholder="e.g. 500mg" />
            </div>
          )}

          {isActive('form') && (
            <div>
              <label className={labelClass}>Form {isRequired('form') && '*'}</label>
              <select {...register('form')} className={inputClass}>
                {MEDICINE_FORMS.filter((form) => form !== 'UNSPECIFIED').map((form) => (
                  <option key={form} value={form}>
                    {form.charAt(0) + form.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </div>
          )}

          {isActive('company') && (
            <div>
              <label className={labelClass}>Company {isRequired('company') && '*'}</label>
              <input {...register('company')} className={inputClass} />
            </div>
          )}

          {isActive('category') && (
            <div>
              <label className={labelClass}>Category {isRequired('category') && '*'}</label>
              <input {...register('category')} className={inputClass} placeholder="e.g. Antibiotic" />
            </div>
          )}
        </div>
      </section>

      <section className={sectionClass}>
        <h2 className={sectionTitleClass}>Prescription defaults</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {isActive('defaultMorning') && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-500">Morning {isRequired('defaultMorning') && '*'}</label>
              <input type="number" min={0} max={10} {...register('defaultMorning')} className={inputClass} />
            </div>
          )}
          {isActive('defaultAfternoon') && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-500">
                Afternoon {isRequired('defaultAfternoon') && '*'}
              </label>
              <input type="number" min={0} max={10} {...register('defaultAfternoon')} className={inputClass} />
            </div>
          )}
          {isActive('defaultEvening') && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-500">Evening {isRequired('defaultEvening') && '*'}</label>
              <input type="number" min={0} max={10} {...register('defaultEvening')} className={inputClass} />
            </div>
          )}
          {isActive('defaultNight') && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-500">Night {isRequired('defaultNight') && '*'}</label>
              <input type="number" min={0} max={10} {...register('defaultNight')} className={inputClass} />
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {isActive('defaultBeforeAfterFood') && (
            <div>
              <label className={labelClass}>Before/after food {isRequired('defaultBeforeAfterFood') && '*'}</label>
              <select {...register('defaultBeforeAfterFood')} className={inputClass}>
                {BEFORE_AFTER_FOOD_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {FOOD_LABEL[option]}
                  </option>
                ))}
              </select>
            </div>
          )}
          {isActive('defaultDurationDays') && (
            <div>
              <label className={labelClass}>Default days {isRequired('defaultDurationDays') && '*'}</label>
              <input type="number" min={1} max={365} {...register('defaultDurationDays')} className={inputClass} />
            </div>
          )}
        </div>
      </section>

      {(isActive('defaultDose') || isActive('defaultInstruction')) && (
        <section className={sectionClass}>
          <h2 className={sectionTitleClass}>Notes</h2>
          <div className="mt-4 grid grid-cols-1 gap-4">
            {isActive('defaultDose') && (
              <div>
                <label className={labelClass}>Dose text {isRequired('defaultDose') && '*'}</label>
                <input {...register('defaultDose')} className={inputClass} placeholder='e.g. 1 tsp' />
              </div>
            )}

            {isActive('defaultInstruction') && (
              <div>
                <label className={labelClass}>Instruction {isRequired('defaultInstruction') && '*'}</label>
                <input {...register('defaultInstruction')} className={inputClass} placeholder="e.g. Take with plenty of water" />
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
