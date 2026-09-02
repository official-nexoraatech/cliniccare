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
    <div className="w-full max-w-7xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <button
            onClick={() => navigate(-1)}
            className="mb-3 flex items-center gap-1.5 text-sm font-medium text-gray-500 transition hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <h1 className="text-2xl font-semibold text-[var(--color-navy)]">
            {isEdit ? 'Edit medicine' : 'Add medicine'}
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <MedicineFormFields register={register} errors={errors} coreFieldDefs={coreFieldDefs} />

        {(customFieldDefs?.length ?? 0) > 0 && (
          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-base font-semibold text-[var(--color-navy)]">Additional details</h2>
            <div className="mt-4">
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
          </section>
        )}

        <div className="sticky bottom-0 -mx-2 flex justify-end gap-3 border-t border-gray-200 bg-[var(--color-bg)] px-2 py-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium transition hover:bg-gray-50 active:translate-y-px"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-[var(--color-primary)] px-7 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 active:translate-y-px disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : isEdit ? 'Save changes' : 'Add medicine'}
          </button>
        </div>
      </form>
    </div>
  );
}
