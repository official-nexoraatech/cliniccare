export interface FeeType {
  id: string;
  name: string;
  amount: number;
  isDefault: boolean;
  isActive: boolean;
}

export interface CreateFeeTypeRequest {
  name: string;
  amount: number;
  isDefault?: boolean;
}

export interface UpdateFeeTypeRequest {
  name?: string;
  amount?: number;
  isDefault?: boolean;
}
