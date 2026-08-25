export const BILL_STATUSES = ['UNPAID', 'PARTIAL', 'PAID', 'CANCELLED'] as const;
export type BillStatus = (typeof BILL_STATUSES)[number];

export const PAYMENT_MODES = ['CASH', 'CARD', 'UPI', 'BANK_TRANSFER'] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export interface BillItemInput {
  /** null/omitted = ad-hoc line typed free-hand, not picked from the FeeType master. */
  feeTypeId?: string;
  name: string;
  quantity: number;
  unitAmount: number;
  sortOrder: number;
}

export interface BillItemDetail extends BillItemInput {
  id: string;
  amount: number;
}

export interface PaymentInput {
  amount: number;
  mode: PaymentMode;
  reference?: string;
}

export interface PaymentDetail extends PaymentInput {
  id: string;
  paidOn: string;
  createdBy: string | null;
}

export interface BillDetail {
  id: string;
  billNo: string;
  patientId: string;
  patientName: string;
  patientMobile: string;
  visitId: string | null;
  date: string;
  items: BillItemDetail[];
  payments: PaymentDetail[];
  subtotal: number;
  discount: number;
  taxPercent: number | null;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  status: BillStatus;
  remark: string | null;
  cancelReason: string | null;
  printedAt: string | null;
  printCount: number;
  createdBy: string | null;
}

/** Lighter shape for list/table views — same fields CertificateDetail-style pages use. */
export interface BillListItem {
  id: string;
  billNo: string;
  patientId: string;
  patientName: string;
  patientMobile: string;
  visitId: string | null;
  date: string;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  status: BillStatus;
}

export interface CreateBillRequest {
  patientId: string;
  visitId?: string;
  items: BillItemInput[];
  discount?: number;
  taxPercent?: number;
  remark?: string;
}

/** Full re-save of the editable fields, same shape as CreateBillRequest minus
 * patientId/visitId (can't change after creation). Only allowed while the bill has
 * no payments yet — see billing.service.ts. */
export interface UpdateBillRequest {
  items: BillItemInput[];
  discount?: number;
  taxPercent?: number;
  remark?: string;
}

export interface RecordPaymentRequest {
  amount: number;
  mode: PaymentMode;
  reference?: string;
}

export interface CancelBillRequest {
  reason: string;
}
