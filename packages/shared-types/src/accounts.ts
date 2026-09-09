import type { BillStatus, PaymentMode } from './billing';

export interface PaymentModeBreakdown {
  mode: PaymentMode;
  amount: number;
}

export interface PaymentAccountBreakdown {
  accountId: string | null;
  accountName: string;
  amount: number;
}

export type PaymentAccountType = 'CASH' | 'BANK';
export type PaymentAccountStatus = 'ACTIVE' | 'INACTIVE';

export interface PaymentAccount {
  id: string;
  name: string;
  type: PaymentAccountType;
  bankName: string | null;
  accountNumberMasked: string | null;
  ifsc: string | null;
  openingBalance: number;
  openingBalanceDate: string;
  status: PaymentAccountStatus;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaymentAccountRequest {
  name: string;
  type: PaymentAccountType;
  bankName?: string;
  accountNumberMasked?: string;
  ifsc?: string;
  openingBalance: number;
  openingBalanceDate: string;
  isDefault?: boolean;
}

export interface UpdatePaymentAccountRequest {
  name?: string;
  bankName?: string;
  accountNumberMasked?: string;
  ifsc?: string;
  status?: PaymentAccountStatus;
  isDefault?: boolean;
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
  paymentAccountBreakdown: PaymentAccountBreakdown[];
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
  accountId: string | null;
  accountName: string | null;
  paidOn: string;
}
