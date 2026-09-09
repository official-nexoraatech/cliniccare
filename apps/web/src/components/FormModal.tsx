import type { ReactNode } from 'react';
import { X } from 'lucide-react';

interface FormModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
};

export function FormModal({ open, title, onClose, children, footer, size = 'md' }: FormModalProps) {
  if (!open) return null;

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className={`flex max-h-[90vh] w-full ${sizeClasses[size]} flex-col overflow-hidden rounded-xl bg-white shadow-xl`}>
        <div className="flex flex-none items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-[var(--color-navy)]">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex flex-none justify-end gap-3 border-t border-gray-200 bg-white px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}
