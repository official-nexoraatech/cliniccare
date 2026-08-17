import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface DatePickerProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(
  ({ label, className, ...props }, ref) => {
    return (
      <label className="flex flex-col gap-1 text-sm">
        {label && <span className="font-medium text-gray-700">{label}</span>}
        <input
          ref={ref}
          type="date"
          className={cn(
            'rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]',
            className,
          )}
          {...props}
        />
      </label>
    );
  },
);

DatePicker.displayName = 'DatePicker';
