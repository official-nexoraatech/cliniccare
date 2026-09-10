import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import type { PatientCustomFieldValues } from '@clinic-care/shared-types';
import { usePatientMutations } from '@/hooks/usePatients';
import { usePatientFieldsQuery } from '@/hooks/usePatientFields';
import { getErrorMessage } from '@/lib/utils';
import {
  calculateAge,
  PatientCustomFields,
  PatientFormFields,
  patientSchema,
  validateCustomFields,
  type PatientFormValues,
} from './patientFormShared';

export function PatientForm() {
  const navigate = useNavigate();
  const { create } = usePatientMutations();
  const { data: allFieldDefs } = usePatientFieldsQuery();
  const coreFieldDefs = allFieldDefs?.filter((f) => f.isCore);
  const customFieldDefs = allFieldDefs?.filter((f) => !f.isCore);

  const [customFieldValues, setCustomFieldValues] = useState<PatientCustomFieldValues>({});
  const [customFieldErrors, setCustomFieldErrors] = useState<Record<string, string>>({});

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PatientFormValues>({
    resolver: zodResolver(patientSchema),
    defaultValues: { gender: 'MALE' },
  });

  const dob = watch('dob');
  useEffect(() => {
    if (dob) {
      setValue('age', calculateAge(dob), { shouldValidate: true });
    }
  }, [dob, setValue]);

  const onSubmit = async (values: PatientFormValues) => {
    const fieldErrors = validateCustomFields(allFieldDefs ?? [], { ...values, ...customFieldValues });
    if (Object.keys(fieldErrors).length > 0) {
      const customKeys = new Set((customFieldDefs ?? []).map((f) => f.key));
      setCustomFieldErrors(Object.fromEntries(Object.entries(fieldErrors).filter(([key]) => customKeys.has(key))));
      toast.error(Object.values(fieldErrors).join(' '));
      return;
    }

    const payload = {
      ...values,
      dob: values.dob || undefined,
      altMobile: values.altMobile || undefined,
      email: values.email || undefined,
      maritalStatus: values.maritalStatus || undefined,
      bloodGroup: values.bloodGroup || undefined,
      customFields: customFieldValues,
    };

    try {
      const result = await create.mutateAsync(payload);
      const patientId = result.patient.id;
      if (result.duplicateMobileWarning) {
        toast.warning('Another active patient already uses this mobile number — saved anyway (families often share one).');
      }
      toast.success(`Patient registered as ${result.patient.patientId}`);
      navigate(`/patients/${patientId}`);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not save patient.'));
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

      <h1 className="mb-6 text-xl font-semibold text-[var(--color-navy)]">New Patient Registration</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
        <PatientFormFields
          register={register}
          errors={errors}
          watch={watch}
          setValue={setValue}
          coreFieldDefs={coreFieldDefs}
        />

        {(customFieldDefs?.length ?? 0) > 0 && (
          <div>
            <h2 className="mb-3 text-sm font-semibold text-[var(--color-navy)]">Additional Details</h2>
            <PatientCustomFields
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
            {isSubmitting ? 'Saving...' : 'Register Patient'}
          </button>
        </div>
      </form>
    </div>
  );
}
