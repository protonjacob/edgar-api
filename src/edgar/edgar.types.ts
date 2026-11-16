// Raw response shapes from SEC EDGAR.

export interface EdgarCompanyTickerEntry {
  cik_str: number;
  ticker: string;
  title: string;
}

/** https://www.sec.gov/files/company_tickers.json, keyed by row index. */
export type EdgarCompanyTickers = Record<string, EdgarCompanyTickerEntry>;

/** Column-oriented: index i across all arrays describes one filing. */
export interface EdgarRecentFilings {
  accessionNumber: string[];
  filingDate: string[];
  reportDate: string[];
  form: string[];
  primaryDocument: string[];
  acceptanceDateTime?: string[];
  act?: string[];
  fileNumber?: string[];
  filmNumber?: string[];
  items?: string[];
  size?: number[];
  isXBRL?: number[];
  isInlineXBRL?: number[];
  primaryDocDescription?: string[];
}

/** https://data.sec.gov/submissions/CIK##########.json */
export interface EdgarSubmissions {
  cik: string;
  name: string;
  tickers: string[];
  exchanges?: string[];
  sic?: string;
  sicDescription?: string;
  filings: {
    recent: EdgarRecentFilings;
  };
}
