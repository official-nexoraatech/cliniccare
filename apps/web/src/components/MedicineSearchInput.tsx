import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Plus, Search } from 'lucide-react';
import type { MedicineSearchResult } from '@clinic-care/shared-types';
import { medicineSchema, MEDICINE_FORM_DEFAULTS, type MedicineFormValues } from '@/lib/medicineSchema';
import { useMedicineMutations, useMedicineSearchQuery } from '@/hooks/useMedicines';
import { getErrorMessage } from '@/lib/utils';
import { FormModal } from './FormModal';
import { MedicineFormFields } from './MedicineFormFields';

const MIN_QUERY_LENGTH = 3;

interface MedicineSearchInputProps {
  onSelect: (medicine: MedicineSearchResult) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export function MedicineSearchInput({ onSelect, placeholder, autoFocus }: MedicineSearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [rawInput, setRawInput] = useState('');
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [isAddOpen, setIsAddOpen] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setQuery(rawInput), 200);
    return () => clearTimeout(timeout);
  }, [rawInput]);

  const searchReady = query.trim().length >= MIN_QUERY_LENGTH;
  const { data: results = [] } = useMedicineSearchQuery(searchReady ? query : '');

  useEffect(() => setHighlightedIndex(0), [results]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const pick = (medicine: MedicineSearchResult) => {
    onSelect(medicine);
    setRawInput('');
    setQuery('');
    setIsOpen(false);
  };

  const totalRows = results.length + 1; // +1 for the "Add new medicine" row

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || !searchReady) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, totalRows - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (highlightedIndex === results.length) {
        setIsAddOpen(true);
      } else if (results[highlightedIndex]) {
        pick(results[highlightedIndex]);
      }
    } else if (event.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input
        ref={inputRef}
        autoFocus={autoFocus}
        value={rawInput}
        onChange={(e) => {
          setRawInput(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder ?? 'Type 3 letters to search medicine...'}
        className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
      />

      {isOpen && searchReady && (
        <div className="absolute z-40 mt-1 w-full min-w-[320px] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
          {results.length === 0 && (
            <p className="px-4 py-3 text-sm text-gray-400">No matching medicines</p>
          )}
          {results.map((medicine, index) => (
            <button
              key={medicine.id}
              onClick={() => pick(medicine)}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm ${
                index === highlightedIndex ? 'bg-gray-100' : 'hover:bg-gray-50'
              }`}
            >
              <span className="font-medium text-gray-800">{medicine.brandName}</span>
              <span className="text-gray-400">
                {medicine.strength ?? ''} {medicine.form.charAt(0) + medicine.form.slice(1).toLowerCase()}
              </span>
            </button>
          ))}
          <button
            onClick={() => setIsAddOpen(true)}
            onMouseEnter={() => setHighlightedIndex(results.length)}
            className={`flex w-full items-center gap-2 border-t border-gray-100 px-4 py-2 text-left text-sm font-medium text-[var(--color-primary)] ${
              highlightedIndex === results.length ? 'bg-gray-100' : 'hover:bg-gray-50'
            }`}
          >
            <Plus className="h-3.5 w-3.5" /> Add new medicine
          </button>
        </div>
      )}

      <QuickAddMedicineModal
        open={isAddOpen}
        initialBrandName={rawInput}
        onClose={() => setIsAddOpen(false)}
        onCreated={(medicine) => {
          setIsAddOpen(false);
          pick(medicine);
        }}
      />
    </div>
  );
}

interface QuickAddMedicineModalProps {
  open: boolean;
  initialBrandName: string;
  onClose: () => void;
  onCreated: (medicine: MedicineSearchResult) => void;
}

function QuickAddMedicineModal({ open, initialBrandName, onClose, onCreated }: QuickAddMedicineModalProps) {
  const { create } = useMedicineMutations();
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
    if (open) {
      reset({ ...MEDICINE_FORM_DEFAULTS, brandName: initialBrandName.length >= MIN_QUERY_LENGTH ? initialBrandName : '' });
    }
  }, [open, initialBrandName, reset]);

  const onSubmit = async (values: MedicineFormValues) => {
    const payload = { ...values, defaultDurationDays: values.defaultDurationDays || undefined };
    try {
      const medicine = await create.mutateAsync(payload);
      toast.success(`${medicine.brandName} added`);
      onCreated({
        id: medicine.id,
        brandName: medicine.brandName,
        genericName: medicine.genericName,
        strength: medicine.strength,
        form: medicine.form,
        defaultMorning: medicine.defaultMorning,
        defaultAfternoon: medicine.defaultAfternoon,
        defaultEvening: medicine.defaultEvening,
        defaultNight: medicine.defaultNight,
        defaultBeforeAfterFood: medicine.defaultBeforeAfterFood,
        defaultDurationDays: medicine.defaultDurationDays,
        defaultDose: medicine.defaultDose,
      });
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not add medicine.'));
    }
  };

  return (
    <FormModal
      open={open}
      title="Add New Medicine"
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit(onSubmit)}
            disabled={isSubmitting}
            className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {isSubmitting ? 'Adding...' : 'Add & Use'}
          </button>
        </>
      }
    >
      <MedicineFormFields register={register} errors={errors} />
    </FormModal>
  );
}
