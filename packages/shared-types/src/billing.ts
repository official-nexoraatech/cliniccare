export const BILL_STATUSES = ['UNPAID', 'PARTIAL', 'PAID', 'CANCELLED'] as const;
export type BillStatus = (typeof BILL_STATUSES)[number];

export const PAYMENT_MODES = ['CASH', 'CARD', 'UPI', 'BANK_TRANSFER'] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

/** Which staff area a charge belongs to. Optional on input — the server infers a
 * sensible default from the adding user's role (DOCTOR -> DOCTOR_PROCEDURE, ASSISTANT
 * -> NURSING, otherwise OTHER) when omitted, so most callers never need to set this. */
export const CHARGE_DEPARTMENTS = ['CONSULTATION', 'DOCTOR_PROCEDURE', 'MEDICINE', 'NURSING', 'LAB_TEST', 'OTHER'] as const;
export type ChargeDepartment = (typeof CHARGE_DEPARTMENTS)[number];

export const BILL_ITEM_STATUSES = ['PENDING', 'CANCELLED', 'WAIVED'] as const;
export type BillItemStatus = (typeof BILL_ITEM_STATUSES)[number];

export interface BillItemInput {
  /** null/omitted = ad-hoc line typed free-hand, not picked from the FeeType master. */
  feeTypeId?: string;
  name: string;
  quantity: number;
  unitAmount: number;
  sortOrder: number;
  department?: ChargeDepartment;
}

export interface BillItemDetail extends BillItemInput {
  id: string;
  amount: number;
  department: ChargeDepartment;
  status: BillItemStatus;
  createdBy: string | null;
  createdByRole: string | null;
  createdAt: string;
  removedBy: string | null;
  removedByRole: string | null;
  removedAt: string | null;
  removeReason: string | null;
}

export interface PaymentInput {
  amount: number;
  mode: PaymentMode;
  reference?: string;
}

export interface PaymentDetail extends PaymentInput {
  id: string;
  accountId: string | null;
  accountName: string | null;
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
  cancelledBy: string | null;
  cancelledByRole: string | null;
  cancelledAt: string | null;
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
  accountId?: string;
}

export interface CancelBillRequest {
  reason: string;
}

/** Cancelling or waiving one specific charge — see billing.service.ts cancelItem/waiveItem. */
export interface RemoveBillItemRequest {
  reason: string;
}
