import type { MedicineCustomFieldValues, MedicineFieldDefinition } from '@clinic-care/shared-types';

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]';
const labelClass = 'mb-1 block text-sm font-medium text-gray-700';

/** Required-field check for the admin-configured fields (Settings → Medicine Fields); ignores inactive ones. */
export function validateMedicineFields(
  fields: MedicineFieldDefinition[],
  values: Record<string, unknown>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    if (field.isActive && field.required && !String(values[field.key] ?? '').trim()) {
      errors[field.key] = `${field.label} is required`;
    }
  }
  return errors;
}

interface MedicineCustomFieldsProps {
  fields: MedicineFieldDefinition[];
  values: MedicineCustomFieldValues;
  onChange: (key: string, value: string) => void;
  errors?: Record<string, string>;
}

/** Renders whatever fields the admin has switched on in Settings → Medicine Fields, in their configured order. */
export function MedicineCustomFields({ fields, values, onChange, errors }: MedicineCustomFieldsProps) {
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
