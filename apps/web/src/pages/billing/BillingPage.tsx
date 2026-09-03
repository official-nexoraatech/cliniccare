import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { ColumnDef } from '@tanstack/react-table';
import { Ban, CreditCard, Download, Eye, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import type { BillDetail, BillItemInput, BillListItem, BillStatus, PatientSearchResult, PaymentMode } from '@clinic-care/shared-types';
import { PAYMENT_MODES } from '@clinic-care/shared-types';
import { DataTable } from '@/components/DataTable';
import { FormModal } from '@/components/FormModal';
import { PrintLayout } from '@/components/PrintLayout';
import { TableSkeleton } from '@/components/Skeleton';
import { formLabelClass, standardFieldInputClass } from '@/components/uiStyles';
import {
  compactTableBodyClass,
  compactTableCellClass,
  compactTableClass,
  compactTableHeaderCellClass,
  compactTableHeaderClass,
  compactTableRowClass,
  compactTableShellClass,
  printTableCellClass,
  printTableClass,
  printTableHeaderCellClass,
  printTableHeaderRowClass,
  printTableRowClass,
} from '@/components/tableStyles';
import { usePatientSearchQuery } from '@/hooks/usePatients';
import { usePatientVisitsQuery } from '@/hooks/useVisits';
import { useClinicQuery } from '@/hooks/useClinic';
import { useFeeTypesQuery } from '@/hooks/useFeeTypes';
import { useBillMutations, useBillQuery, useBillsQuery } from '@/hooks/useBilling';
import { useAuthStore } from '@/store/auth-store';
import { hasPermission } from '@/lib/permissions';
import { downloadCsv } from '@/lib/csv';
import { getErrorMessage } from '@/lib/utils';

const STATUS_LABEL: Record<BillStatus, string> = { UNPAID: 'Unpaid', PARTIAL: 'Partial', PAID: 'Paid', CANCELLED: 'Cancelled' };
const STATUS_STYLE: Record<BillStatus, string> = {
  UNPAID: 'bg-red-100 text-red-700',
  PARTIAL: 'bg-amber-100 text-amber-700',
  PAID: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-200 text-gray-600',
};
const MODE_LABEL: Record<PaymentMode, string> = { CASH: 'Cash', CARD: 'Card', UPI: 'UPI', BANK_TRANSFER: 'Bank Transfer' };

const inputClass = standardFieldInputClass;
const labelClass = formLabelClass;

function fmtMoney(paise: number) {
  return `₹${paise.toLocaleString('en-IN')}`;
}

function fmtDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString('en-IN') : '—';
}

interface ItemRow extends BillItemInput {
  key: string;
}

function newRow(sortOrder: number): ItemRow {
  return { key: crypto.randomUUID(), name: '', quantity: 1, unitAmount: 0, sortOrder };
}

/** Shared by Create and (later) Edit — a plain rows table, quick-add from the FeeType
 * master or a free-hand line, same "admin master + ad-hoc override" idea as picking a
 * medicine vs. typing a custom prescription instruction. */
function BillItemsEditor({ rows, onChange }: { rows: ItemRow[]; onChange: (rows: ItemRow[]) => void }) {
  const { data: feeTypes = [] } = useFeeTypesQuery();
  const activeFeeTypes = feeTypes.filter((f) => f.isActive);

  const updateRow = (key: string, patch: Partial<ItemRow>) => {
    onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const removeRow = (key: string) => {
    const filtered = rows.filter((row) => row.key !== key);
    onChange(filtered.length > 0 ? filtered : [newRow(0)]);
  };

  const addFromFeeType = (feeTypeId: string) => {
    const feeType = activeFeeTypes.find((f) => f.id === feeTypeId);
    if (!feeType) return;
    onChange([...rows, { key: crypto.randomUUID(), feeTypeId: feeType.id, name: feeType.name, quantity: 1, unitAmount: feeType.amount, sortOrder: rows.length }]);
  };

  const subtotal = rows.reduce((sum, row) => sum + row.quantity * row.unitAmount, 0);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className={labelClass}>Line items</label>
        {activeFeeTypes.length > 0 && (
          <select
            value=""
            onChange={(e) => e.target.value && addFromFeeType(e.target.value)}
            className="rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-600"
          >
            <option value="">+ Add from fee list</option>
            {activeFeeTypes.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} — {fmtMoney(f.amount)}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className={compactTableShellClass}>
        <table className={compactTableClass}>
          <thead className={compactTableHeaderClass}>
            <tr>
              <th className={compactTableHeaderCellClass}>Description</th>
              <th className={`${compactTableHeaderCellClass} w-20`}>Qty</th>
              <th className={`${compactTableHeaderCellClass} w-28`}>Rate</th>
              <th className={`${compactTableHeaderCellClass} w-28`}>Amount</th>
              <th className={`${compactTableHeaderCellClass} w-10`} />
            </tr>
          </thead>
          <tbody className={compactTableBodyClass}>
            {rows.map((row) => (
              <tr key={row.key} className={compactTableRowClass}>
                <td className={compactTableCellClass}>
                  <input
                    value={row.name}
                    onChange={(e) => updateRow(row.key, { name: e.target.value })}
                    placeholder="Item description"
                    className="w-full border-0 bg-transparent text-sm focus:outline-none"
                  />
                </td>
                <td className={compactTableCellClass}>
                  <input
                    type="number"
                    min={1}
                    value={row.quantity}
                    onChange={(e) => updateRow(row.key, { quantity: Number(e.target.value) || 1 })}
                    className="w-full border-0 bg-transparent text-sm focus:outline-none"
                  />
                </td>
                <td className={compactTableCellClass}>
                  <input
                    type="number"
                    min={0}
                    value={row.unitAmount}
                    onChange={(e) => updateRow(row.key, { unitAmount: Number(e.target.value) || 0 })}
                    className="w-full border-0 bg-transparent text-sm focus:outline-none"
                  />
                </td>
                <td className={`${compactTableCellClass} text-gray-600`}>{fmtMoney(row.quantity * row.unitAmount)}</td>
                <td className={compactTableCellClass}>
                  <button onClick={() => removeRow(row.key)} className="text-gray-300 hover:text-red-500">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <button onClick={() => onChange([...rows, newRow(rows.length)])} className="text-xs font-medium text-[var(--color-primary)]">
          + Add line
        </button>
        <p className="text-sm font-medium text-gray-700">Subtotal: {fmtMoney(subtotal)}</p>
      </div>
    </div>
  );
}

function BillBody({ bill }: { bill: BillDetail }) {
  return (
    <div>
      <div className="flex items-start justify-between text-xs text-gray-500">
        <span>Bill No: {bill.billNo}</span>
        <span>Date: {fmtDate(bill.date)}</span>
      </div>
      <p className="mt-2 text-sm font-medium text-gray-800">
        {bill.patientName} <span className="text-gray-400">· {bill.patientMobile}</span>
      </p>

      <table className={printTableClass}>
        <thead>
          <tr className={printTableHeaderRowClass}>
            <th className={printTableHeaderCellClass}>Description</th>
            <th className={`${printTableHeaderCellClass} w-16`}>Qty</th>
            <th className={`${printTableHeaderCellClass} w-20`}>Rate</th>
            <th className={`${printTableHeaderCellClass} w-24 pr-0`}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {bill.items.map((item) => (
            <tr key={item.id} className={printTableRowClass}>
              <td className={`${printTableCellClass} text-gray-800`}>{item.name}</td>
              <td className={`${printTableCellClass} text-gray-500`}>{item.quantity}</td>
              <td className={`${printTableCellClass} text-gray-500`}>{fmtMoney(item.unitAmount)}</td>
              <td className="py-2 font-medium text-gray-700">{fmtMoney(item.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 flex justify-end">
        <div className="w-56 text-xs">
          <div className="flex justify-between py-1 text-gray-500">
            <span>Subtotal</span>
            <span>{fmtMoney(bill.subtotal)}</span>
          </div>
          {bill.discount > 0 && (
            <div className="flex justify-between py-1 text-gray-500">
              <span>Discount</span>
              <span>-{fmtMoney(bill.discount)}</span>
            </div>
          )}
          {bill.taxPercent !== null && (
            <div className="flex justify-between py-1 text-gray-500">
              <span>Tax ({bill.taxPercent}%)</span>
              <span>{fmtMoney(bill.taxAmount)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-gray-200 py-1.5 text-sm font-semibold text-gray-800">
            <span>Total</span>
            <span>{fmtMoney(bill.totalAmount)}</span>
          </div>
          <div className="flex justify-between py-1 text-gray-500">
            <span>Paid</span>
            <span>{fmtMoney(bill.paidAmount)}</span>
          </div>
          <div className="flex justify-between py-1 font-medium text-red-600">
            <span>Due</span>
            <span>{fmtMoney(bill.dueAmount)}</span>
          </div>
        </div>
      </div>

      {bill.payments.length > 0 && (
        <div className="mt-4 border-t border-gray-100 pt-3 text-xs text-gray-500">
          <p className="mb-1 font-medium text-gray-600">Payments</p>
          {bill.payments.map((p) => (
            <p key={p.id}>
              {fmtDate(p.paidOn)} — {fmtMoney(p.amount)} via {MODE_LABEL[p.mode]}
              {p.reference ? ` (${p.reference})` : ''}
              {p.createdBy ? ` · Collected by ${p.createdBy}` : ''}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/** Lets reception top up an already-partially-paid bill with a charge that only became
 * known partway through the visit (injection, dressing, ...) — see billing.service.ts's
 * addItem(). Kept separate from BillItemsEditor: each add is its own immediate API call
 * against a bill that may already have payments, not a draft staged for one big submit. */
function AddBillItemInline({ bill }: { bill: BillDetail }) {
  const { data: feeTypes = [] } = useFeeTypesQuery();
  const { addItem } = useBillMutations();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState(0);
  const activeFeeTypes = feeTypes.filter((f) => f.isActive);

  const submit = async (feeTypeId?: string, itemName?: string, itemAmount?: number) => {
    const finalName = (itemName ?? name).trim();
    const finalAmount = itemAmount ?? amount;
    if (!finalName || finalAmount <= 0) return;
    try {
      await addItem.mutateAsync({
        id: bill.id,
        payload: { feeTypeId, name: finalName, quantity: 1, unitAmount: finalAmount, sortOrder: bill.items.length },
      });
      setName('');
      setAmount(0);
      toast.success('Item added to bill');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not add item.'));
    }
  };

  return (
    <div className="no-print mt-4 flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-gray-300 p-3">
      {activeFeeTypes.length > 0 && (
        <select
          value=""
          onChange={(e) => {
            const f = activeFeeTypes.find((x) => x.id === e.target.value);
            if (f) submit(f.id, f.name, f.amount);
          }}
          className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-600"
        >
          <option value="">+ Add from fee list</option>
          {activeFeeTypes.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name} — {fmtMoney(f.amount)}
            </option>
          ))}
        </select>
      )}
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Or type a custom item"
        className="w-40 rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
      />
      <input
        type="number"
        min={1}
        value={amount || ''}
        onChange={(e) => setAmount(Number(e.target.value) || 0)}
        placeholder="Amount"
        className="w-24 rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
      />
      <button
        onClick={() => submit()}
        disabled={addItem.isPending || !name.trim() || amount <= 0}
        className="rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        Add to Bill
      </button>
    </div>
  );
}

function CreateBillModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (bill: BillDetail, print: boolean) => void }) {
  const { create } = useBillMutations();
  const { data: clinic } = useClinicQuery();

  const [search, setSearch] = useState('');
  const { data: results = [] } = usePatientSearchQuery(search);
  const [patient, setPatient] = useState<PatientSearchResult | null>(null);
  const { data: visits = [] } = usePatientVisitsQuery(patient?.id);
  const [visitId, setVisitId] = useState('');

  const [rows, setRows] = useState<ItemRow[]>([newRow(0)]);
  const [discount, setDiscount] = useState(0);
  const [taxPercent, setTaxPercent] = useState(0);
  const [remark, setRemark] = useState('');

  const reset = () => {
    setSearch('');
    setPatient(null);
    setVisitId('');
    setRows([newRow(0)]);
    setDiscount(0);
    setTaxPercent(0);
    setRemark('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const subtotal = rows.reduce((sum, row) => sum + row.quantity * row.unitAmount, 0);
  const taxableAmount = Math.max(subtotal - (discount || 0), 0);
  const taxAmount = clinic?.taxEnabled && taxPercent ? Math.round((taxableAmount * taxPercent) / 100) : 0;
  const total = taxableAmount + taxAmount;

  const submit = async (andPrint: boolean) => {
    const validRows = rows.filter((row) => row.name.trim() && row.unitAmount >= 0);
    if (!patient || validRows.length === 0) {
      toast.error('Pick a patient and add at least one line item.');
      return;
    }
    try {
      const bill = await create.mutateAsync({
        patientId: patient.id,
        visitId: visitId || undefined,
        items: validRows.map((row, index) => ({
          feeTypeId: row.feeTypeId,
          name: row.name,
          quantity: row.quantity,
          unitAmount: row.unitAmount,
          sortOrder: index,
        })),
        discount: clinic?.discountEnabled ? discount || undefined : undefined,
        taxPercent: clinic?.taxEnabled && taxPercent ? taxPercent : undefined,
        remark: remark || undefined,
      });
      toast.success(`Bill ${bill.billNo} created`);
      onCreated(bill, andPrint);
      handleClose();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not create bill.'));
    }
  };

  return (
    <FormModal open={open} title="New Bill" size="lg" onClose={handleClose}>
      <div className="flex flex-col gap-4">
        {!patient ? (
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search patient by mobile or name"
              className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            />
            {results.length > 0 && (
              <div className="mt-2 overflow-hidden rounded-lg border border-gray-200">
                {results.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPatient(p)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50"
                  >
                    <span>
                      {p.name} <span className="text-gray-400">· {p.age}/{p.gender.charAt(0)}</span>
                    </span>
                    <span className="text-gray-400">{p.mobile}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
              <p className="text-sm">
                <span className="font-medium text-gray-800">{patient.name}</span>{' '}
                <span className="text-gray-500">
                  · {patient.age}/{patient.gender.charAt(0)} · {patient.mobile}
                </span>
              </p>
              <button onClick={() => setPatient(null)} className="text-xs font-medium text-[var(--color-primary)]">
                Change
              </button>
            </div>

            {visits.length > 0 && (
              <div>
                <label className={labelClass}>Link to visit (optional)</label>
                <select value={visitId} onChange={(e) => setVisitId(e.target.value)} className={inputClass}>
                  <option value="">No visit — standalone bill</option>
                  {visits.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.visitNo} — {fmtDate(v.visitDate)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <BillItemsEditor rows={rows} onChange={setRows} />

            <div className="grid grid-cols-3 gap-3">
              {clinic?.discountEnabled && (
                <div>
                  <label className={labelClass}>Discount</label>
                  <input type="number" min={0} value={discount} onChange={(e) => setDiscount(Number(e.target.value) || 0)} className={inputClass} />
                </div>
              )}
              {clinic?.taxEnabled && (
                <div>
                  <label className={labelClass}>{clinic.taxLabel} %</label>
                  <input type="number" min={0} max={100} value={taxPercent} onChange={(e) => setTaxPercent(Number(e.target.value) || 0)} className={inputClass} />
                </div>
              )}
              <div className={clinic?.discountEnabled || clinic?.taxEnabled ? '' : 'col-span-3'}>
                <label className={labelClass}>Remark (optional)</label>
                <input value={remark} onChange={(e) => setRemark(e.target.value)} className={inputClass} />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-teal-50 px-4 py-3">
              <p className="text-sm text-gray-600">Total payable</p>
              <p className="text-lg font-bold text-[var(--color-primary)]">{fmtMoney(total)}</p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => submit(false)}
                disabled={create.isPending}
                className="rounded-lg border border-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-primary)] hover:bg-teal-50 disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={() => submit(true)}
                disabled={create.isPending}
                className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                Save & Print
              </button>
            </div>
          </>
        )}
      </div>
    </FormModal>
  );
}

/** Only reachable while the bill has zero payments — see billing.service.ts's
 * update() guard. Patient/visit are immutable once created, so this only re-edits
 * items/discount/tax/remark, mirroring CreateBillModal minus the patient picker. */
function EditBillModal({ billId, onClose }: { billId: string | null; onClose: () => void }) {
  const { data: bill } = useBillQuery(billId ?? undefined);
  const { update } = useBillMutations();
  const { data: clinic } = useClinicQuery();

  const [rows, setRows] = useState<ItemRow[]>([]);
  const [discount, setDiscount] = useState(0);
  const [taxPercent, setTaxPercent] = useState(0);
  const [remark, setRemark] = useState('');
  const [loadedId, setLoadedId] = useState<string | null>(null);

  useEffect(() => {
    if (bill && bill.id !== loadedId) {
      setRows(
        bill.items.map((item) => ({
          key: item.id,
          feeTypeId: item.feeTypeId,
          name: item.name,
          quantity: item.quantity,
          unitAmount: item.unitAmount,
          sortOrder: item.sortOrder,
        })),
      );
      setDiscount(bill.discount);
      setTaxPercent(bill.taxPercent ?? 0);
      setRemark(bill.remark ?? '');
      setLoadedId(bill.id);
    }
  }, [bill, loadedId]);

  const open = Boolean(billId);

  const handleClose = () => {
    setLoadedId(null);
    onClose();
  };

  const subtotal = rows.reduce((sum, row) => sum + row.quantity * row.unitAmount, 0);
  const taxableAmount = Math.max(subtotal - (discount || 0), 0);
  const taxAmount = clinic?.taxEnabled && taxPercent ? Math.round((taxableAmount * taxPercent) / 100) : 0;
  const total = taxableAmount + taxAmount;

  const submit = async () => {
    const validRows = rows.filter((row) => row.name.trim() && row.unitAmount >= 0);
    if (!bill || validRows.length === 0) {
      toast.error('Add at least one line item.');
      return;
    }
    try {
      await update.mutateAsync({
        id: bill.id,
        payload: {
          items: validRows.map((row, index) => ({
            feeTypeId: row.feeTypeId,
            name: row.name,
            quantity: row.quantity,
            unitAmount: row.unitAmount,
            sortOrder: index,
          })),
          discount: clinic?.discountEnabled ? discount || undefined : undefined,
          taxPercent: clinic?.taxEnabled && taxPercent ? taxPercent : undefined,
          remark: remark || undefined,
        },
      });
      toast.success(`Bill ${bill.billNo} updated`);
      handleClose();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not update bill.'));
    }
  };

  return (
    <FormModal open={open} title={bill ? `Edit Bill — ${bill.billNo}` : 'Edit Bill'} size="lg" onClose={handleClose}>
      {bill && (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm">
            <span className="font-medium text-gray-800">{bill.patientName}</span>{' '}
            <span className="text-gray-500">· {bill.patientMobile}</span>
          </div>

          <BillItemsEditor rows={rows} onChange={setRows} />

          <div className="grid grid-cols-3 gap-3">
            {clinic?.discountEnabled && (
              <div>
                <label className={labelClass}>Discount</label>
                <input type="number" min={0} value={discount} onChange={(e) => setDiscount(Number(e.target.value) || 0)} className={inputClass} />
              </div>
            )}
            {clinic?.taxEnabled && (
              <div>
                <label className={labelClass}>{clinic.taxLabel} %</label>
                <input type="number" min={0} max={100} value={taxPercent} onChange={(e) => setTaxPercent(Number(e.target.value) || 0)} className={inputClass} />
              </div>
            )}
            <div className={clinic?.discountEnabled || clinic?.taxEnabled ? '' : 'col-span-3'}>
              <label className={labelClass}>Remark (optional)</label>
              <input value={remark} onChange={(e) => setRemark(e.target.value)} className={inputClass} />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-teal-50 px-4 py-3">
            <p className="text-sm text-gray-600">Total payable</p>
            <p className="text-lg font-bold text-[var(--color-primary)]">{fmtMoney(total)}</p>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={submit}
              disabled={update.isPending}
              className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              Save Changes
            </button>
          </div>
        </div>
      )}
    </FormModal>
  );
}

function RecordPaymentModal({ bill, onClose }: { bill: BillListItem | null; onClose: () => void }) {
  const { recordPayment } = useBillMutations();
  const [amount, setAmount] = useState(0);
  const [mode, setMode] = useState<PaymentMode>('CASH');
  const [reference, setReference] = useState('');

  const open = Boolean(bill);

  // Prefill once per bill, without fighting the user's own edits to the field.
  useEffect(() => {
    if (bill) setAmount(bill.dueAmount);
  }, [bill?.id]);

  const handleClose = () => {
    setAmount(0);
    setMode('CASH');
    setReference('');
    onClose();
  };

  const submit = async () => {
    if (!bill || amount <= 0) return;
    try {
      await recordPayment.mutateAsync({ id: bill.id, payload: { amount, mode, reference: reference || undefined } });
      toast.success('Payment recorded');
      handleClose();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not record payment.'));
    }
  };

  return (
    <FormModal
      open={open}
      title={`Record Payment — ${bill?.billNo ?? ''}`}
      size="sm"
      onClose={handleClose}
      footer={
        <>
          <button onClick={handleClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={amount <= 0 || recordPayment.isPending}
            className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            Record Payment
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {bill && <p className="text-xs text-gray-500">Due: {fmtMoney(bill.dueAmount)}</p>}
        <div>
          <label className={labelClass}>Amount</label>
          <input type="number" min={1} value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Mode</label>
          <div className="flex flex-wrap gap-2">
            {PAYMENT_MODES.map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                  mode === m ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white' : 'border-gray-300 text-gray-600'
                }`}
              >
                {MODE_LABEL[m]}
              </button>
            ))}
          </div>
        </div>
        {mode !== 'CASH' && (
          <div>
            <label className={labelClass}>Reference (optional)</label>
            <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UPI txn ID / cheque no." className={inputClass} />
          </div>
        )}
      </div>
    </FormModal>
  );
}

function CancelBillModal({ bill, onClose }: { bill: BillListItem | null; onClose: () => void }) {
  const { cancel } = useBillMutations();
  const [reason, setReason] = useState('');

  const submit = async () => {
    if (!bill || !reason.trim()) return;
    try {
      await cancel.mutateAsync({ id: bill.id, payload: { reason } });
      toast.success('Bill cancelled');
      setReason('');
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not cancel bill.'));
    }
  };

  return (
    <FormModal
      open={Boolean(bill)}
      title={`Cancel Bill ${bill?.billNo ?? ''}`}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50">
            Back
          </button>
          <button
            onClick={submit}
            disabled={!reason.trim() || cancel.isPending}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            Cancel Bill
          </button>
        </>
      }
    >
      <p className="text-sm text-gray-500">
        This bill stays on record (never deleted) but is marked cancelled. Any payments already recorded stay on the audit trail. Give a reason.
      </p>
      <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for cancellation" className={`${inputClass} mt-3`} />
    </FormModal>
  );
}

export function BillingPage() {
  const currentUser = useAuthStore((state) => state.user);
  const canEdit = hasPermission(currentUser, 'billing:edit');
  const { data: bills, isLoading } = useBillsQuery();
  const { data: clinic } = useClinicQuery();
  const { markPrinted } = useBillMutations();

  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<BillListItem | null>(null);
  const [cancelTarget, setCancelTarget] = useState<BillListItem | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const { data: previewTarget } = useBillQuery(previewId ?? undefined);
  const [printTarget, setPrintTarget] = useState<BillDetail | null>(null);

  const handlePrint = async (bill: BillDetail) => {
    try {
      const updated = await markPrinted.mutateAsync(bill.id);
      setPrintTarget(updated);
      setTimeout(() => window.print(), 100);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not print bill.'));
    }
  };

  const handleExport = () => {
    if (!bills?.length) return;
    downloadCsv(
      `billing-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Bill No', 'Patient', 'Mobile', 'Date', 'Total', 'Paid', 'Due', 'Status'],
      bills.map((b) => [b.billNo, b.patientName, b.patientMobile, b.date, b.totalAmount, b.paidAmount, b.dueAmount, STATUS_LABEL[b.status]]),
    );
  };

  const columns: ColumnDef<BillListItem>[] = [
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
      cell: ({ getValue }) => {
        const due = getValue<number>();
        return <span className={due > 0 ? 'font-medium text-red-600' : 'text-gray-500'}>{fmtMoney(due)}</span>;
      },
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[row.original.status]}`}>{STATUS_LABEL[row.original.status]}</span>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <button onClick={() => setPreviewId(row.original.id)} title="View / Print" className="rounded-lg border border-gray-300 p-1.5 text-gray-500 hover:bg-gray-50">
            <Eye className="h-3.5 w-3.5" />
          </button>
          {canEdit && row.original.status !== 'CANCELLED' && row.original.paidAmount === 0 && (
            <button onClick={() => setEditId(row.original.id)} title="Edit" className="rounded-lg border border-gray-300 p-1.5 text-gray-500 hover:bg-gray-50">
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          {canEdit && row.original.status !== 'CANCELLED' && row.original.dueAmount > 0 && (
            <button
              onClick={() => setPaymentTarget(row.original)}
              title="Record Payment"
              className="rounded-lg border border-gray-300 p-1.5 text-green-600 hover:bg-green-50"
            >
              <CreditCard className="h-3.5 w-3.5" />
            </button>
          )}
          {canEdit && row.original.status !== 'CANCELLED' && (
            <button onClick={() => setCancelTarget(row.original)} title="Cancel" className="rounded-lg border border-gray-300 p-1.5 text-red-500 hover:bg-red-50">
              <Ban className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="no-print flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-navy)]">Billing</h1>
          <p className="text-sm text-gray-500">Consultation, lab and procedure bills — create, receive payment, print.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            disabled={!bills?.length}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
          {canEdit && (
            <button
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> New Bill
            </button>
          )}
        </div>
      </div>

      <div className="no-print">
        {isLoading ? <TableSkeleton rows={6} columns={8} /> : <DataTable columns={columns} data={bills ?? []} emptyMessage="No bills yet." />}
      </div>

      <CreateBillModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={(bill, print) => print && handlePrint(bill)} />
      <EditBillModal billId={editId} onClose={() => setEditId(null)} />
      <RecordPaymentModal bill={paymentTarget} onClose={() => setPaymentTarget(null)} />
      <CancelBillModal bill={cancelTarget} onClose={() => setCancelTarget(null)} />

      {clinic && previewTarget && (
        <FormModal open onClose={() => setPreviewId(null)} title="Bill Preview" size="lg">
          <PrintLayout clinic={clinic} documentTitle="Bill / Receipt" onPrint={() => { handlePrint(previewTarget); setPreviewId(null); }}>
            <BillBody bill={previewTarget} />
          </PrintLayout>
          {canEdit && previewTarget.status !== 'CANCELLED' && <AddBillItemInline bill={previewTarget} />}
        </FormModal>
      )}

      {clinic && printTarget && (
        <div className="hidden print:block">
          <PrintLayout clinic={clinic} documentTitle="Bill / Receipt">
            <BillBody bill={printTarget} />
          </PrintLayout>
        </div>
      )}
    </div>
  );
}
