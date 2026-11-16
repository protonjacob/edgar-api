export interface Filing {
  accessionNumber: string;
  formType: string;
  filingDate: string;
  reportDate: string | null;
  primaryDocumentUrl: string;
}

export interface FilingFilters {
  formTypes?: string[];
  startDate?: string;
  endDate?: string;
}

export interface PageRequest {
  limit: number;
  cursor?: string;
}

export const DEFAULT_PAGE_LIMIT = 50;
export const MAX_PAGE_LIMIT = 200;
