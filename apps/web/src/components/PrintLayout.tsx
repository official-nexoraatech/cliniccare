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
  /** Called instead of the default window.print() — e.g. to save/mark-printed first (Print Preview modal). */
  onPrint?: () => void;
}

export function PrintLayout({ clinic, documentTitle, children, onPrint }: PrintLayoutProps) {
  const doctorInfo = (
    <div className="text-right text-xs leading-relaxed text-gray-500">
      {clinic.doctorName && <p className="text-sm font-semibold text-gray-800">{clinic.doctorName}</p>}
      {clinic.degree && <p>{clinic.degree}</p>}
      {clinic.regnNumber && <p>Reg. No: {clinic.regnNumber}</p>}
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex justify-end print:hidden">
        <button
          onClick={onPrint ?? (() => window.print())}
          className="flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          <Printer className="h-4 w-4" /> Print
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-10 print:rounded-none print:border-0 print:p-0">
        {clinic.letterheadPath ? (
          // A designed letterhead image is the complete header, in whatever form the
          // clinic chose to include — same as a physical pre-printed letterhead: the
          // paper stock already has everything on it, the software doesn't add its own
          // text on top. Don't re-render doctor/clinic details a second time here.
          <header className="border-b-2 border-[var(--color-primary)] pb-3">
            <img
              src={resolveServerUrl(clinic.letterheadPath)}
              alt={clinic.name}
              className="max-h-24 w-full object-contain object-left"
            />
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
            <div className="flex-1">
              <h1 className="text-2xl font-bold tracking-tight text-[var(--color-navy)]">{clinic.name}</h1>
              {clinic.address && <p className="mt-1 text-xs text-gray-500">{clinic.address}</p>}
              {clinic.phone && <p className="text-xs text-gray-500">{clinic.phone}</p>}
            </div>
            {doctorInfo}
          </header>
        )}

        <div className="mt-5 flex items-center justify-center gap-3">
          <span className="h-px flex-1 bg-gray-200" />
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">{documentTitle}</h2>
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
