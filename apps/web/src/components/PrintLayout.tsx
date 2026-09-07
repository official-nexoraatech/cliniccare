import type { ReactNode } from 'react';
import { Printer } from 'lucide-react';
import { resolveServerUrl } from '@/lib/api';

interface ClinicHeader {
  name: string;
  address?: string | null;
  phone?: string | null;
  doctorName?: string | null;
  degree?: string | null;
  regnNumber?: string | null;
  logoPath?: string | null;
  letterheadPath?: string | null;
}

interface PrintLayoutProps {
  clinic: ClinicHeader;
  documentTitle: string;
  children: ReactNode;
  /** Called instead of the default window.print(), e.g. to save/mark-printed first. */
  onPrint?: () => void;
}

export function PrintLayout({ clinic, documentTitle, children, onPrint }: PrintLayoutProps) {
  const doctorName = clinic.doctorName
    ? clinic.doctorName.trim().toLowerCase().startsWith('dr.')
      ? clinic.doctorName
      : `Dr. ${clinic.doctorName}`
    : null;

  const clinicInfo = (
    <div className="min-w-0 flex-1">
      <h1 className="text-2xl font-bold text-[var(--color-navy)]">{clinic.name}</h1>
      {clinic.address && <p className="mt-1 text-xs font-medium leading-relaxed text-slate-600">{clinic.address}</p>}
      {clinic.phone && <p className="mt-1 text-xs font-medium text-slate-500">{clinic.phone}</p>}
    </div>
  );

  const doctorInfo = (
    <div className="text-right text-xs leading-relaxed text-slate-600">
      {doctorName && <p className="text-sm font-semibold text-slate-900">{doctorName}</p>}
      {clinic.degree && <p className="font-medium">{clinic.degree}</p>}
      {clinic.regnNumber && <p>Reg. No: {clinic.regnNumber}</p>}
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex justify-end print:hidden">
        <button
          onClick={onPrint ?? (() => window.print())}
          className="flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 active:translate-y-px"
        >
          <Printer className="h-4 w-4" /> Print
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-10 print:rounded-none print:border-0 print:p-0">
        {clinic.letterheadPath ? (
          <header className="border-b-2 border-[var(--color-primary)] pb-4">
            <img
              src={resolveServerUrl(clinic.letterheadPath)}
              alt={clinic.name}
              className="max-h-24 w-full object-contain object-left"
            />
            <div className="mt-3 flex items-start gap-5 rounded-lg bg-slate-50 px-4 py-3">
              {clinicInfo}
              {doctorInfo}
            </div>
          </header>
        ) : (
          <header className="flex items-center gap-5 border-b-2 border-[var(--color-primary)] pb-5">
            {clinic.logoPath && (
              <img
                src={resolveServerUrl(clinic.logoPath)}
                alt={clinic.name}
                className="h-16 w-16 flex-shrink-0 rounded-lg object-contain"
              />
            )}
            {clinicInfo}
            {doctorInfo}
          </header>
        )}

        <div className="mt-5 flex items-center justify-center gap-3">
          <span className="h-px flex-1 bg-gray-200" />
          <h2 className="rounded-md bg-[var(--color-primary)] px-3 py-1 text-xs font-semibold uppercase text-white">{documentTitle}</h2>
          <span className="h-px flex-1 bg-gray-200" />
        </div>

        <div className="mt-6">{children}</div>

        <footer className="mt-10 border-t border-gray-100 pt-4 text-center text-[10px] text-gray-400">
          This is a computer generated document.
        </footer>
      </div>
    </div>
  );
}
