import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { AlertCircle, CheckCircle2, FileText, Landmark, ListChecks, PieChart, Plus, Power, Receipt, RotateCcw, Wallet } from 'lucide-react';
import type { OutstandingDueItem, PaymentAccount, PaymentAccountType, PaymentMode } from '@clinic-care/shared-types';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DataTable } from '@/components/DataTable';
import { InlineSkeleton, TableSkeleton } from '@/components/Skeleton';
import {
  actionIconClass,
  actionToneClass,
  actionTooltipClass,
  formLabelClass,
  primaryButtonClass,
  secondaryButtonClass,
  sectionCardClass,
  sectionHeaderClass,
  sectionIconClass,
  standardFieldInputClass,
} from '@/components/uiStyles';
import { useAccountsSummaryQuery, useOutstandingDuesQuery, usePaymentAccountMutations, usePaymentAccountsQuery } from '@/hooks/useAccounts';
import { useAuthStore } from '@/store/auth-store';
import { hasPermission } from '@/lib/permissions';
import { getErrorMessage } from '@/lib/utils';

const MODE_LABEL: Record<PaymentMode, string> = { CASH: 'Cash', CARD: 'Card', UPI: 'UPI', BANK_TRANSFER: 'Bank Transfer' };

const STAT_TONE_CLASS = {
  blue: 'bg-blue-50 text-blue-600 ring-1 ring-blue-100',
  green: 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100',
  red: 'bg-red-50 text-red-600 ring-1 ring-red-100',
  cyan: 'bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100',
} as const;

const inputClass = standardFieldInputClass;
const labelClass = formLabelClass;

type AccountConfirmAction = 'default' | 'deactivate' | 'reactivate';

interface AccountConfirmTarget {
  account: PaymentAccount;
  action: AccountConfirmAction;
}

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
  const [confirmTarget, setConfirmTarget] = useState<AccountConfirmTarget | null>(null);
  const { data: summary, isLoading } = useAccountsSummaryQuery(from, to);
  const { data: dues, isLoading: duesLoading } = useOutstandingDuesQuery();
  const { data: paymentAccounts = [], isLoading: accountsLoading } = usePaymentAccountsQuery();
  const { create, update, updateStatus, remove } = usePaymentAccountMutations();

  const cards = [
    { label: 'Total Billed', value: isLoading ? <InlineSkeleton className="h-8 w-28" /> : fmtMoney(summary?.totalBilled ?? 0), icon: Receipt, tone: 'blue' as const },
    { label: 'Total Collected', value: isLoading ? <InlineSkeleton className="h-8 w-28" /> : fmtMoney(summary?.totalCollected ?? 0), icon: Wallet, tone: 'green' as const },
    { label: 'Outstanding Due', value: isLoading ? <InlineSkeleton className="h-8 w-28" /> : fmtMoney(summary?.totalDue ?? 0), icon: AlertCircle, tone: 'red' as const },
    { label: 'Bills Raised', value: isLoading ? <InlineSkeleton className="h-8 w-16" /> : String(summary?.billCount ?? 0), icon: FileText, tone: 'cyan' as const },
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
      setConfirmTarget(null);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not update account.'));
    }
  };

  const onDeactivateAccount = async (account: PaymentAccount) => {
    try {
      await remove.mutateAsync(account.id);
      toast.success(`${account.name} deactivated`);
      setConfirmTarget(null);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not deactivate account.'));
    }
  };

  const onReactivateAccount = async (account: PaymentAccount) => {
    try {
      await updateStatus.mutateAsync({ id: account.id, status: 'ACTIVE' });
      toast.success(`${account.name} reactivated`);
      setConfirmTarget(null);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not reactivate account.'));
    }
  };

  const onConfirmAccountAction = () => {
    if (!confirmTarget) return;
    if (confirmTarget.action === 'default') {
      void onSetDefault(confirmTarget.account);
      return;
    }
    if (confirmTarget.action === 'deactivate') {
      void onDeactivateAccount(confirmTarget.account);
      return;
    }
    void onReactivateAccount(confirmTarget.account);
  };

  const accountTypeLabel = confirmTarget?.account.type === 'CASH' ? 'cash' : 'bank';
  const confirmTitle =
    confirmTarget?.action === 'default'
      ? `Make "${confirmTarget.account.name}" default?`
      : confirmTarget?.action === 'deactivate'
        ? `Deactivate "${confirmTarget.account.name}"?`
        : confirmTarget?.action === 'reactivate'
          ? `Reactivate "${confirmTarget.account.name}"?`
          : '';
  const confirmDescription =
    confirmTarget?.action === 'default'
      ? `New ${accountTypeLabel} payments will auto-select this account. The old default ${accountTypeLabel} account will stop being default, but past payments stay unchanged.`
      : confirmTarget?.action === 'deactivate'
        ? `This account will be hidden from billing payment selection. It is not deleted, and old bills/payments linked to it will still show this account name.`
        : confirmTarget?.action === 'reactivate'
          ? `This account will appear again in billing payment selection. It will not become default unless you choose the default option separately.`
          : undefined;
  const confirmLabel =
    confirmTarget?.action === 'default'
      ? 'Make Default'
      : confirmTarget?.action === 'deactivate'
        ? 'Deactivate'
        : confirmTarget?.action === 'reactivate'
          ? 'Reactivate'
          : 'Confirm';
  const confirmBusy = update.isPending || updateStatus.isPending || remove.isPending;

  const dueColumns: ColumnDef<OutstandingDueItem>[] = [
    { accessorKey: 'billNo', header: 'Bill No' },
    {
      id: 'patient',
      header: 'Patient',
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-slate-800">{row.original.patientName}</p>
          <p className="text-xs text-slate-400">{row.original.patientMobile}</p>
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
          <p className="text-sm text-slate-500">Collection and outstanding-due summary, built from Billing records.</p>
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
          <Link to="/billing" className={secondaryButtonClass}>
            Go to Billing
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className={sectionCardClass}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{card.label}</p>
              <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${STAT_TONE_CLASS[card.tone]}`}>
                <card.icon className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 text-2xl font-bold text-[var(--color-navy)]">{card.value}</div>
          </div>
        ))}
      </div>

      <div className={sectionCardClass}>
        <div className={sectionHeaderClass}>
          <span className={sectionIconClass}>
            <PieChart className="h-4 w-4" />
          </span>
          Collection by Payment Mode
        </div>
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
          <p className="text-sm text-slate-400">No payments recorded in this range.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {summary.paymentModeBreakdown.map((m) => (
              <div key={m.mode} className="flex items-center gap-3">
                <span className="w-28 text-sm text-slate-600">{MODE_LABEL[m.mode]}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-[var(--color-primary)]" style={{ width: `${(m.amount / maxModeAmount) * 100}%` }} />
                </div>
                <span className="w-24 text-right text-sm font-medium text-slate-700">{fmtMoney(m.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className={sectionCardClass}>
          <div className={sectionHeaderClass}>
            <span className={sectionIconClass}>
              <Landmark className="h-4 w-4" />
            </span>
            Collection by Account
          </div>
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
            <p className="text-sm text-slate-400">No account-wise collections in this range.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {summary.paymentAccountBreakdown.map((account) => (
                <div key={account.accountId ?? account.accountName} className="flex items-center gap-3">
                  <span className="w-36 truncate text-sm text-slate-600">{account.accountName}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-emerald-600" style={{ width: `${(account.amount / maxAccountAmount) * 100}%` }} />
                  </div>
                  <span className="w-24 text-right text-sm font-medium text-slate-700">{fmtMoney(account.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={sectionCardClass}>
          <div className={sectionHeaderClass}>
            <span className={sectionIconClass}>
              <Landmark className="h-4 w-4" />
            </span>
            <div>
              <p>Cash & Bank Accounts</p>
              <p className="text-xs font-normal text-slate-400">Billing uses cash accounts for cash payments and bank accounts for UPI/card/bank payments.</p>
            </div>
          </div>

          {canEdit && (
            <div className="mb-4 flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
                <div>
                  <label className={labelClass}>Account name</label>
                  <input
                    value={accountName}
                    onChange={(event) => setAccountName(event.target.value)}
                    placeholder={accountType === 'CASH' ? 'Cash - Front Desk' : 'Main Bank Account'}
                    className={inputClass}
                    maxLength={80}
                  />
                </div>
                <div>
                  <label className={labelClass}>Type</label>
                  <select value={accountType} onChange={(event) => setAccountType(event.target.value as PaymentAccountType)} className={inputClass}>
                    <option value="CASH">Cash</option>
                    <option value="BANK">Bank</option>
                  </select>
                </div>
              </div>

              {accountType === 'BANK' && (
                <div className="grid gap-3 sm:grid-cols-[1fr_7rem_10rem]">
                  <div>
                    <label className={labelClass}>Bank name</label>
                    <input
                      value={bankName}
                      onChange={(event) => setBankName(event.target.value)}
                      placeholder="e.g. HDFC Bank"
                      className={inputClass}
                      maxLength={80}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Last 4 digits</label>
                    <input
                      value={accountNumberMasked}
                      onChange={(event) => setAccountNumberMasked(event.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="1234"
                      className={inputClass}
                      inputMode="numeric"
                      maxLength={4}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>IFSC</label>
                    <input
                      value={ifsc}
                      onChange={(event) => setIfsc(event.target.value.toUpperCase().slice(0, 11))}
                      placeholder="HDFC0001234"
                      className={inputClass}
                      maxLength={11}
                    />
                  </div>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-[9rem_1fr]">
                <div>
                  <label className={labelClass}>Opening balance</label>
                  <input
                    type="number"
                    min={0}
                    value={openingBalance}
                    onChange={(event) => setOpeningBalance(event.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>As of</label>
                  <input
                    type="date"
                    max={todayIso()}
                    value={openingBalanceDate}
                    onChange={(event) => setOpeningBalanceDate(event.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-slate-200 pt-3">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
                  <input
                    type="checkbox"
                    checked={makeDefault}
                    onChange={(event) => setMakeDefault(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-[var(--color-primary)] focus:ring-teal-100"
                  />
                  Set as default
                </label>
                <button
                  type="button"
                  onClick={onAddAccount}
                  disabled={!accountName.trim() || create.isPending}
                  className={`${primaryButtonClass} inline-flex items-center gap-1.5 px-4 py-2 text-sm`}
                >
                  <Plus className="h-4 w-4" /> Add Account
                </button>
              </div>
            </div>
          )}

          <div className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
            {accountsLoading ? (
              <div className="p-3">
                <InlineSkeleton className="h-5 w-full" />
              </div>
            ) : paymentAccounts.length === 0 ? (
              <p className="p-3 text-sm text-slate-400">No accounts yet.</p>
            ) : (
              paymentAccounts.map((account) => (
                <div key={account.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`truncate text-sm font-medium ${account.status === 'ACTIVE' ? 'text-slate-800' : 'text-slate-400 line-through'}`}>{account.name}</p>
                      {account.isDefault && (
                        <span className="shrink-0 rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-primary)] ring-1 ring-teal-100">
                          Default
                        </span>
                      )}
                      {account.status !== 'ACTIVE' && (
                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 ring-1 ring-slate-200">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">
                      {account.type === 'CASH' ? 'Cash' : `Bank${account.bankName ? ` - ${account.bankName}` : ''}`}
                      {account.accountNumberMasked ? ` •••• ${account.accountNumberMasked}` : ''}
                    </p>
                  </div>
                  {canEdit && (
                    <div className="flex shrink-0 gap-1.5">
                      {account.status === 'ACTIVE' && !account.isDefault && (
                        <button
                          type="button"
                          onClick={() => setConfirmTarget({ account, action: 'default' })}
                          className={`${actionIconClass} ${actionToneClass.green}`}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          <span className={actionTooltipClass}>Make default</span>
                        </button>
                      )}
                      {account.status === 'ACTIVE' ? (
                        <button
                          type="button"
                          onClick={() => setConfirmTarget({ account, action: 'deactivate' })}
                          className={`${actionIconClass} ${actionToneClass.red}`}
                        >
                          <Power className="h-4 w-4" />
                          <span className={actionTooltipClass}>Deactivate</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmTarget({ account, action: 'reactivate' })}
                          className={`${actionIconClass} ${actionToneClass.green}`}
                        >
                          <RotateCcw className="h-4 w-4" />
                          <span className={actionTooltipClass}>Reactivate</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className={sectionCardClass}>
        <div className={sectionHeaderClass}>
          <span className={sectionIconClass}>
            <ListChecks className="h-4 w-4" />
          </span>
          Outstanding Dues
          {!duesLoading && dues && dues.length > 0 && (
            <span className="ml-auto rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-600 ring-1 ring-red-100">
              {dues.length} pending
            </span>
          )}
        </div>
        {duesLoading ? <TableSkeleton rows={5} columns={6} /> : <DataTable columns={dueColumns} data={dues ?? []} emptyMessage="No outstanding dues — all bills settled." />}
      </div>

      <ConfirmDialog
        open={Boolean(confirmTarget)}
        title={confirmTitle}
        description={confirmDescription}
        confirmLabel={confirmBusy ? 'Saving...' : confirmLabel}
        destructive={confirmTarget?.action === 'deactivate'}
        onConfirm={confirmBusy ? () => undefined : onConfirmAccountAction}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
}
