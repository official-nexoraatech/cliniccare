export interface Counter {
  id: string;
  key: string;
  prefix: string;
  currentValue: number;
  financialYear: string;
}

export interface UpdateCounterRequest {
  prefix?: string;
  currentValue?: number;
}
