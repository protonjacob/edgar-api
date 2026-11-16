import { Injectable, NotFoundException } from '@nestjs/common';
import { EdgarService } from '../edgar/edgar.service.js';
import { Company } from './company.js';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Resolves tickers to CIKs using SEC's company ticker list. The list is
 * large and changes rarely, so it is cached in memory.
 */
@Injectable()
export class TickerCikService {
  private companies?: Map<string, Company>;
  private loadedAt = 0;
  private loading?: Promise<Map<string, Company>>;

  constructor(private readonly edgarService: EdgarService) {}

  async resolve(ticker: string): Promise<Company> {
    const companies = await this.getCompanies();
    const company = companies.get(ticker.toUpperCase());
    if (!company) {
      throw new NotFoundException(`Company with ticker '${ticker}' not found`);
    }
    return company;
  }

  private getCompanies(): Promise<Map<string, Company>> {
    if (this.companies && Date.now() - this.loadedAt < CACHE_TTL_MS) {
      return Promise.resolve(this.companies);
    }

    // Share one in-flight load between concurrent callers.
    this.loading ??= this.loadCompanies().finally(() => {
      this.loading = undefined;
    });
    return this.loading;
  }

  private async loadCompanies(): Promise<Map<string, Company>> {
    const tickers = await this.edgarService.getCompanyTickers();
    const companies = new Map<string, Company>();
    for (const entry of Object.values(tickers)) {
      const ticker = entry.ticker.toUpperCase();
      companies.set(ticker, { cik: entry.cik_str, ticker, name: entry.title });
    }

    this.companies = companies;
    this.loadedAt = Date.now();
    return companies;
  }
}
