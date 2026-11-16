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
