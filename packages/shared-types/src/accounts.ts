import type { BillStatus, PaymentMode } from './billing';

export interface PaymentModeBreakdown {
  mode: PaymentMode;
  amount: number;
}

/** Revenue summary over a date range — reads Bill+Payment, no separate ledger table. */
export interface AccountsSummary {
  from: string;
  to: string;
  totalBilled: number;
  totalCollected: number;
  totalDue: number;
  billCount: number;
  paymentModeBreakdown: PaymentModeBreakdown[];
}

export interface OutstandingDueItem {
  id: string;
  billNo: string;
  patientId: string;
  patientName: string;
  patientMobile: string;
  date: string;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  status: BillStatus;
}

export interface DaybookEntry {
  billId: string;
  billNo: string;
  patientName: string;
  paymentId: string;
  amount: number;
  mode: PaymentMode;
  paidOn: string;
}
