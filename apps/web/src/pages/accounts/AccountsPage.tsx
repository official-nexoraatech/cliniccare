import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { CheckCircle2, Landmark, Plus, Trash2 } from 'lucide-react';
import type { OutstandingDueItem, PaymentAccount, PaymentAccountType, PaymentMode } from '@clinic-care/shared-types';
import { DataTable } from '@/components/DataTable';
import { InlineSkeleton, TableSkeleton } from '@/components/Skeleton';
import { formLabelClass, standardFieldInputClass } from '@/components/uiStyles';
import { useAccountsSummaryQuery, useOutstandingDuesQuery, usePaymentAccountMutations, usePaymentAccountsQuery } from '@/hooks/useAccounts';
import { useAuthStore } from '@/store/auth-store';
import { hasPermission } from '@/lib/permissions';
import { getErrorMessage } from '@/lib/utils';

const MODE_LABEL: Record<PaymentMode, string> = { CASH: 'Cash', CARD: 'Card', UPI: 'UPI', BANK_TRANSFER: 'Bank Transfer' };

const inputClass = standardFieldInputClass;
const labelClass = formLabelClass;

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
  const currentUser = useAuthStore((state) => state.user);
  const canEdit = hasPermission(currentUser, 'billing:edit');
  const [from, setFrom] = useState(monthStartIso());
  const [to, setTo] = useState(todayIso());
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState<PaymentAccountType>('CASH');
  const [bankName, setBankName] = useState('');
  const [accountNumberMasked, setAccountNumberMasked] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [openingBalanceDate, setOpeningBalanceDate] = useState(todayIso());
  const [makeDefault, setMakeDefault] = useState(false);
  const { data: summary, isLoading } = useAccountsSummaryQuery(from, to);
  const { data: dues, isLoading: duesLoading } = useOutstandingDuesQuery();
  const { data: paymentAccounts = [], isLoading: accountsLoading } = usePaymentAccountsQuery();
  const { create, update, remove } = usePaymentAccountMutations();

  const cards = [
    { label: 'Total Billed', value: isLoading ? <InlineSkeleton className="h-8 w-28" /> : fmtMoney(summary?.totalBilled ?? 0) },
    { label: 'Total Collected', value: isLoading ? <InlineSkeleton className="h-8 w-28" /> : fmtMoney(summary?.totalCollected ?? 0) },
    { label: 'Outstanding Due', value: isLoading ? <InlineSkeleton className="h-8 w-28" /> : fmtMoney(summary?.totalDue ?? 0) },
    { label: 'Bills Raised', value: isLoading ? <InlineSkeleton className="h-8 w-16" /> : String(summary?.billCount ?? 0) },
  ];

  const maxModeAmount = Math.max(1, ...(summary?.paymentModeBreakdown.map((m) => m.amount) ?? [0]));
  const maxAccountAmount = Math.max(1, ...(summary?.paymentAccountBreakdown.map((m) => m.amount) ?? [0]));

  const onAddAccount = async () => {
    if (!accountName.trim()) return;
    try {
      await create.mutateAsync({
        name: accountName.trim(),
        type: accountType,
        bankName: accountType === 'BANK' ? bankName.trim() || undefined : undefined,
        accountNumberMasked: accountType === 'BANK' ? accountNumberMasked.trim() || undefined : undefined,
        ifsc: accountType === 'BANK' ? ifsc.trim().toUpperCase() || undefined : undefined,
        openingBalance: Math.max(0, Math.round(Number(openingBalance) || 0)),
        openingBalanceDate: new Date(openingBalanceDate).toISOString(),
        isDefault: makeDefault,
      });
      setAccountName('');
      setBankName('');
      setAccountNumberMasked('');
      setIfsc('');
      setOpeningBalance('0');
      setOpeningBalanceDate(todayIso());
      setMakeDefault(false);
      toast.success('Account added');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not add account.'));
    }
  };

  const onSetDefault = async (account: PaymentAccount) => {
    try {
      await update.mutateAsync({ id: account.id, payload: { isDefault: true, status: 'ACTIVE' } });
      toast.success(`${account.name} set as default`);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not update account.'));
    }
  };

  const onDeactivateAccount = async (account: PaymentAccount) => {
    try {
      await remove.mutateAsync(account.id);
      toast.success(`${account.name} removed`);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not remove account.'));
    }
  };

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
            <div className="mt-2 text-2xl font-bold text-[var(--color-navy)]">{card.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <p className="mb-3 text-sm font-semibold text-[var(--color-navy)]">Collection by Payment Mode</p>
        {isLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3">
                <InlineSkeleton className="h-4 w-28" />
                <InlineSkeleton className="h-2 flex-1 rounded-full" />
                <InlineSkeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        ) : !summary || summary.paymentModeBreakdown.length === 0 ? (
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

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="mb-3 text-sm font-semibold text-[var(--color-navy)]">Collection by Account</p>
          {isLoading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="flex items-center gap-3">
                  <InlineSkeleton className="h-4 w-32" />
                  <InlineSkeleton className="h-2 flex-1 rounded-full" />
                  <InlineSkeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          ) : !summary || summary.paymentAccountBreakdown.length === 0 ? (
            <p className="text-sm text-gray-400">No account-wise collections in this range.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {summary.paymentAccountBreakdown.map((account) => (
                <div key={account.accountId ?? account.accountName} className="flex items-center gap-3">
                  <span className="w-36 truncate text-sm text-gray-600">{account.accountName}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full rounded-full bg-emerald-600" style={{ width: `${(account.amount / maxAccountAmount) * 100}%` }} />
                  </div>
                  <span className="w-24 text-right text-sm font-medium text-gray-700">{fmtMoney(account.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <Landmark className="h-4 w-4 text-[var(--color-primary)]" />
            <p className="text-sm font-semibold text-[var(--color-navy)]">Cash & Bank Accounts</p>
          </div>
          <p className="mt-1 text-xs text-gray-400">Billing uses cash accounts for cash payments and bank accounts for UPI/card/bank payments.</p>

          {canEdit && (
            <div className="mt-4 flex flex-col gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_8rem]">
                <input
                  value={accountName}
                  onChange={(event) => setAccountName(event.target.value)}
                  placeholder={accountType === 'CASH' ? 'Cash - Front Desk' : 'Main Bank Account'}
                  className={inputClass}
                  maxLength={80}
                />
                <select value={accountType} onChange={(event) => setAccountType(event.target.value as PaymentAccountType)} className={inputClass}>
                  <option value="CASH">Cash</option>
                  <option value="BANK">Bank</option>
                </select>
              </div>

              {accountType === 'BANK' && (
                <div className="grid gap-2 sm:grid-cols-[1fr_6rem_9rem]">
                  <input
                    value={bankName}
                    onChange={(event) => setBankName(event.target.value)}
                    placeholder="Bank name"
                    className={inputClass}
                    maxLength={80}
                  />
                  <input
                    value={accountNumberMasked}
                    onChange={(event) => setAccountNumberMasked(event.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="Last 4"
                    className={inputClass}
                    inputMode="numeric"
                    maxLength={4}
                  />
                  <input
                    value={ifsc}
                    onChange={(event) => setIfsc(event.target.value.toUpperCase().slice(0, 11))}
                    placeholder="IFSC"
                    className={inputClass}
                    maxLength={11}
                  />
                </div>
              )}

              <div className="grid gap-2 sm:grid-cols-[8rem_1fr_auto]">
                <input
                  type="number"
                  min={0}
                  value={openingBalance}
                  onChange={(event) => setOpeningBalance(event.target.value)}
                  placeholder="Opening"
                  className={inputClass}
                />
                <input
                  type="date"
                  max={todayIso()}
                  value={openingBalanceDate}
                  onChange={(event) => setOpeningBalanceDate(event.target.value)}
                  className={inputClass}
                />
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 whitespace-nowrap text-xs font-medium text-gray-500">
                    <input type="checkbox" checked={makeDefault} onChange={(event) => setMakeDefault(event.target.checked)} />
                    Default
                  </label>
                  <button
                    type="button"
                    onClick={onAddAccount}
                    disabled={!accountName.trim() || create.isPending}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-100">
            {accountsLoading ? (
              <div className="p-3">
                <InlineSkeleton className="h-5 w-full" />
              </div>
            ) : paymentAccounts.length === 0 ? (
              <p className="p-3 text-sm text-gray-400">No accounts yet.</p>
            ) : (
              paymentAccounts.map((account) => (
                <div key={account.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className={`truncate text-sm font-medium ${account.status === 'ACTIVE' ? 'text-gray-800' : 'text-gray-400 line-through'}`}>{account.name}</p>
                    <p className="text-xs text-gray-400">
                      {account.type === 'CASH' ? 'Cash' : `Bank${account.bankName ? ` - ${account.bankName}` : ''}`}
                      {account.accountNumberMasked ? ` - ${account.accountNumberMasked}` : ''}
                      {account.isDefault ? ' - Default' : account.status === 'ACTIVE' ? ' - Active' : ' - Inactive'}
                    </p>
                  </div>
                  {canEdit && account.status === 'ACTIVE' && (
                    <div className="flex shrink-0 gap-1">
                      {!account.isDefault && (
                        <button
                          type="button"
                          onClick={() => onSetDefault(account)}
                          className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50"
                          title="Make default"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onDeactivateAccount(account)}
                        className="rounded-lg border border-red-100 p-1.5 text-red-500 hover:bg-red-50"
                        title="Remove"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div>
        <p className="mb-3 text-sm font-semibold text-[var(--color-navy)]">Outstanding Dues</p>
        {duesLoading ? <TableSkeleton rows={5} columns={6} /> : <DataTable columns={dueColumns} data={dues ?? []} emptyMessage="No outstanding dues — all bills settled." />}
      </div>
    </div>
  );
}
