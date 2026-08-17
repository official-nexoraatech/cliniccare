import type { ReactNode } from 'react';
import { Printer } from 'lucide-react';

interface ClinicHeader {
  name: string;
  address?: string | null;
  phone?: string | null;
  doctorName?: string | null;
  degree?: string | null;
  regnNumber?: string | null;
  logoPath?: string | null;
}

interface PrintLayoutProps {
  clinic: ClinicHeader;
  documentTitle: string;
  children: ReactNode;
}

export function PrintLayout({ clinic, documentTitle, children }: PrintLayoutProps) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex justify-end print:hidden">
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          <Printer className="h-4 w-4" /> Print
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-8 print:rounded-none print:border-0 print:p-0">
        <header className="flex items-center gap-4 border-b-2 border-[var(--color-primary)] pb-4">
          {clinic.logoPath && (
            <img src={clinic.logoPath} alt={clinic.name} className="h-14 w-14 object-contain" />
          )}
          <div className="flex-1">
            <h1 className="text-xl font-bold text-[var(--color-navy)]">{clinic.name}</h1>
            {clinic.address && <p className="text-xs text-gray-500">{clinic.address}</p>}
            {clinic.phone && <p className="text-xs text-gray-500">{clinic.phone}</p>}
          </div>
          <div className="text-right text-xs text-gray-500">
            {clinic.doctorName && <p className="font-medium text-gray-700">{clinic.doctorName}</p>}
            {clinic.degree && <p>{clinic.degree}</p>}
            {clinic.regnNumber && <p>Reg. No: {clinic.regnNumber}</p>}
          </div>
        </header>

        <h2 className="mt-4 text-center text-sm font-semibold uppercase tracking-wide text-gray-500">
          {documentTitle}
        </h2>

        <div className="mt-4">{children}</div>

        <footer className="mt-8 pt-4 text-center text-[10px] text-gray-400">
          This is a computer generated document.
        </footer>
      </div>
    </div>
  );
}
