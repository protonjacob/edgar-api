import { Injectable, NotFoundException } from '@nestjs/common';
import { CachedEdgarService } from '../edgar/cached-edgar.service.js';
import { EdgarRecentFilings } from '../edgar/edgar.types.js';
import { Company } from './company.js';
import { Filing, FilingFilters } from './filing.js';
import { TickerCikService } from './ticker-cik.service.js';

const ARCHIVES_BASE_URL = 'https://www.sec.gov/Archives/edgar/data';

@Injectable()
export class CompaniesService {
  constructor(
    private readonly tickerCikService: TickerCikService,
    private readonly edgarService: CachedEdgarService,
  ) {}

  getCompany(ticker: string): Promise<Company> {
    return this.tickerCikService.resolve(ticker);
  }

  /**
   * Lists the company's recent filings, newest first. Form types match
   * exactly (case-insensitive), so amendments such as `10-K/A` are only
   * included when requested explicitly. The date range applies to the report
   * date and its bounds are inclusive.
   */
  async listFilings(ticker: string, filters: FilingFilters): Promise<Filing[]> {
    const filings = await this.getRecentFilings(ticker);
    const formTypes = filters.formTypes?.map((type) => type.toUpperCase());
    const { startDate, endDate } = filters;

    return filings
      .filter(
        (filing) =>
          !formTypes?.length ||
          formTypes.includes(filing.formType.toUpperCase()),
      )
      .filter((filing) => isInDateRange(filing.reportDate, startDate, endDate))
      .sort(
        (a, b) =>
          b.filingDate.localeCompare(a.filingDate) ||
          b.accessionNumber.localeCompare(a.accessionNumber),
      );
  }

  /**
   * @param accessionNumber accession number in its dashed form.
   */
  async getFiling(ticker: string, accessionNumber: string): Promise<Filing> {
    const filings = await this.getRecentFilings(ticker);
    const filing = filings.find((f) => f.accessionNumber === accessionNumber);
    if (!filing) {
      throw new NotFoundException(
        `Filing '${accessionNumber}' not found for ticker '${ticker}'`,
      );
    }
    return filing;
  }

  private async getRecentFilings(ticker: string): Promise<Filing[]> {
    const { cik } = await this.tickerCikService.resolve(ticker);
    const submissions = await this.edgarService.getSubmissions(cik);
    return toFilings(cik, submissions.filings.recent);
  }
}

// Dates are ISO `YYYY-MM-DD`, so string comparison orders them correctly.
// Filings without a report date never match a date range.
function isInDateRange(
  reportDate: string | null,
  startDate?: string,
  endDate?: string,
): boolean {
  if (startDate === undefined && endDate === undefined) {
    return true;
  }
  return (
    reportDate !== null &&
    (startDate === undefined || reportDate >= startDate) &&
    (endDate === undefined || reportDate <= endDate)
  );
}

function toFilings(cik: number, recent: EdgarRecentFilings): Filing[] {
  return recent.accessionNumber.map((accessionNumber, i) => ({
    accessionNumber,
    formType: recent.form[i],
    filingDate: recent.filingDate[i],
    reportDate: recent.reportDate[i] || null,
    primaryDocumentUrl: [
      ARCHIVES_BASE_URL,
      cik,
      accessionNumber.replaceAll('-', ''),
      recent.primaryDocument[i],
    ].join('/'),
  }));
}
