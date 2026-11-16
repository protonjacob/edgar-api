import { Injectable, NotFoundException } from '@nestjs/common';
import { CachedEdgarService } from '../edgar/cached-edgar.service.js';
import { Company } from './company.js';

/** Resolves tickers to CIKs using SEC's company ticker list. */
@Injectable()
export class TickerCikService {
  constructor(private readonly edgar: CachedEdgarService) {}

  async resolve(ticker: string): Promise<Company> {
    const wanted = ticker.toUpperCase();
    const tickers = await this.edgar.getCompanyTickers();
    const entry = Object.values(tickers).find(
      (candidate) => candidate.ticker.toUpperCase() === wanted,
    );
    if (!entry) {
      throw new NotFoundException(`Company with ticker '${ticker}' not found`);
    }
    return { cik: entry.cik_str, ticker: wanted, name: entry.title };
  }
}
