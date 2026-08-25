import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import type { MedicineCustomFieldValues } from '@clinic-care/shared-types';
import { medicineSchema, MEDICINE_FORM_DEFAULTS, type MedicineFormValues } from '@/lib/medicineSchema';
import { MedicineFormFields } from '@/components/MedicineFormFields';
import { MedicineCustomFields, validateMedicineFields } from '@/components/MedicineCustomFields';
import { useMedicineMutations, useMedicineQuery } from '@/hooks/useMedicines';
import { useMedicineFieldsQuery } from '@/hooks/useMedicineFields';
import { getErrorMessage } from '@/lib/utils';

export function MedicineForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { data: existing } = useMedicineQuery(id);
  const { create, update } = useMedicineMutations();
  const { data: allFieldDefs } = useMedicineFieldsQuery();
  const coreFieldDefs = allFieldDefs?.filter((f) => f.isCore);
  const customFieldDefs = allFieldDefs?.filter((f) => !f.isCore);

  const [customFieldValues, setCustomFieldValues] = useState<MedicineCustomFieldValues>({});
  const [customFieldErrors, setCustomFieldErrors] = useState<Record<string, string>>({});

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<MedicineFormValues>({
    resolver: zodResolver(medicineSchema),
    defaultValues: MEDICINE_FORM_DEFAULTS,
  });

  useEffect(() => {
    if (existing) {
      reset({
        brandName: existing.brandName,
        genericName: existing.genericName ?? '',
        strength: existing.strength ?? '',
        form: existing.form,
        company: existing.company ?? '',
        category: existing.category ?? '',
        defaultDose: existing.defaultDose ?? '',
        defaultMorning: existing.defaultMorning,
        defaultAfternoon: existing.defaultAfternoon,
        defaultEvening: existing.defaultEvening,
        defaultNight: existing.defaultNight,
        defaultBeforeAfterFood: existing.defaultBeforeAfterFood,
        defaultDurationDays: existing.defaultDurationDays ?? '',
        defaultInstruction: existing.defaultInstruction ?? '',
      });
      setCustomFieldValues(existing.customFields ?? {});
    }
  }, [existing, reset]);

  const onSubmit = async (values: MedicineFormValues) => {
    const fieldErrors = validateMedicineFields(allFieldDefs ?? [], { ...values, ...customFieldValues });
    if (Object.keys(fieldErrors).length > 0) {
      const customKeys = new Set((customFieldDefs ?? []).map((f) => f.key));
      setCustomFieldErrors(Object.fromEntries(Object.entries(fieldErrors).filter(([key]) => customKeys.has(key))));
      toast.error(Object.values(fieldErrors).join(' '));
      return;
    }

    const payload = {
      ...values,
      defaultDurationDays: values.defaultDurationDays || undefined,
      customFields: customFieldValues,
    };

    try {
      if (isEdit && id) {
        await update.mutateAsync({ id, payload });
        toast.success('Medicine updated');
        navigate('/medicines');
      } else {
        const result = await create.mutateAsync(payload);
        toast.success(`${result.brandName} added to the medicine master`);
        navigate('/medicines');
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not save medicine.'));
    }
  };

  return (
    <div className="w-full">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <h1 className="mb-6 text-xl font-semibold text-[var(--color-navy)]">
        {isEdit ? 'Edit Medicine' : 'Add Medicine'}
      </h1>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
        <MedicineFormFields register={register} errors={errors} coreFieldDefs={coreFieldDefs} />

        {(customFieldDefs?.length ?? 0) > 0 && (
          <div>
            <h2 className="mb-3 text-sm font-semibold text-[var(--color-navy)]">Additional Details</h2>
            <MedicineCustomFields
              fields={customFieldDefs ?? []}
              values={customFieldValues}
              errors={customFieldErrors}
              onChange={(key, value) => {
                setCustomFieldValues((prev) => ({ ...prev, [key]: value }));
                setCustomFieldErrors((prev) => {
                  if (!prev[key]) return prev;
                  const { [key]: _removed, ...rest } = prev;
                  return rest;
                });
              }}
            />
          </div>
        )}

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
            {isSubmitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Medicine'}
          </button>
        </div>
      </form>
    </div>
  );
}
