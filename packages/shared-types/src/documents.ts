export const DOCUMENT_CATEGORIES = [
  'LAB_REPORT',
  'XRAY',
  'PRESCRIPTION_SCAN',
  'DISCHARGE_SUMMARY',
  'ID_PROOF',
  'OTHER',
] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export interface DocumentDetail {
  id: string;
  patientId: string;
  visitId: string | null;
  fileName: string;
  filePath: string;
  fileType: string;
  fileSize: number;
  category: DocumentCategory;
  description: string | null;
  uploadedOn: string;
}
