import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import type { OutstandingDueItem, PaymentMode } from '@clinic-care/shared-types';
import { DataTable } from '@/components/DataTable';
import { useAccountsSummaryQuery, useOutstandingDuesQuery } from '@/hooks/useAccounts';

const MODE_LABEL: Record<PaymentMode, string> = { CASH: 'Cash', CARD: 'Card', UPI: 'UPI', BANK_TRANSFER: 'Bank Transfer' };

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]';
const labelClass = 'mb-1 block text-sm font-medium text-gray-700';

function fmtMoney(paise: number) {
  return `₹${paise.toLocaleString('en-IN')}`;
}

function fmtDate(value: string) {
  return new Date(value).toLocaleDateString('en-IN');
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartIso() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export function AccountsPage() {
  const [from, setFrom] = useState(monthStartIso());
  const [to, setTo] = useState(todayIso());
  const { data: summary, isLoading } = useAccountsSummaryQuery(from, to);
  const { data: dues, isLoading: duesLoading } = useOutstandingDuesQuery();

  const cards = [
    { label: 'Total Billed', value: isLoading ? '—' : fmtMoney(summary?.totalBilled ?? 0) },
    { label: 'Total Collected', value: isLoading ? '—' : fmtMoney(summary?.totalCollected ?? 0) },
    { label: 'Outstanding Due', value: isLoading ? '—' : fmtMoney(summary?.totalDue ?? 0) },
    { label: 'Bills Raised', value: isLoading ? '—' : String(summary?.billCount ?? 0) },
  ];

  const maxModeAmount = Math.max(1, ...(summary?.paymentModeBreakdown.map((m) => m.amount) ?? [0]));

  const dueColumns: ColumnDef<OutstandingDueItem>[] = [
    { accessorKey: 'billNo', header: 'Bill No' },
    {
      id: 'patient',
      header: 'Patient',
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-gray-800">{row.original.patientName}</p>
          <p className="text-xs text-gray-400">{row.original.patientMobile}</p>
        </div>
      ),
    },
    { accessorKey: 'date', header: 'Date', cell: ({ getValue }) => fmtDate(getValue<string>()) },
    { accessorKey: 'totalAmount', header: 'Total', cell: ({ getValue }) => fmtMoney(getValue<number>()) },
    { accessorKey: 'paidAmount', header: 'Paid', cell: ({ getValue }) => fmtMoney(getValue<number>()) },
    {
      accessorKey: 'dueAmount',
      header: 'Due',
      cell: ({ getValue }) => <span className="font-medium text-red-600">{fmtMoney(getValue<number>())}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-navy)]">Accounts</h1>
          <p className="text-sm text-gray-500">Collection and outstanding-due summary, built from Billing records.</p>
        </div>
        <div className="flex items-end gap-3">
          <div>
            <label className={labelClass}>From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`${inputClass} w-auto`} />
          </div>
          <div>
            <label className={labelClass}>To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={`${inputClass} w-auto`} />
          </div>
          <Link to="/billing" className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
            Go to Billing
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{card.label}</p>
            <p className="mt-2 text-2xl font-bold text-[var(--color-navy)]">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <p className="mb-3 text-sm font-semibold text-[var(--color-navy)]">Collection by Payment Mode</p>
        {!summary || summary.paymentModeBreakdown.length === 0 ? (
          <p className="text-sm text-gray-400">No payments recorded in this range.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {summary.paymentModeBreakdown.map((m) => (
              <div key={m.mode} className="flex items-center gap-3">
                <span className="w-28 text-sm text-gray-600">{MODE_LABEL[m.mode]}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full bg-[var(--color-primary)]" style={{ width: `${(m.amount / maxModeAmount) * 100}%` }} />
                </div>
                <span className="w-24 text-right text-sm font-medium text-gray-700">{fmtMoney(m.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="mb-3 text-sm font-semibold text-[var(--color-navy)]">Outstanding Dues</p>
        {duesLoading ? <p className="text-sm text-gray-400">Loading...</p> : <DataTable columns={dueColumns} data={dues ?? []} emptyMessage="No outstanding dues — all bills settled." />}
      </div>
    </div>
  );
}
