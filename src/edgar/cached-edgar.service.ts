import { Injectable } from '@nestjs/common';
import { CikPaddingService } from './cik-padding.service.js';
import { EdgarService } from './edgar.service.js';
import type { EdgarCompanyTickers, EdgarSubmissions } from './edgar.types.js';

// The ticker list changes rarely; filings arrive throughout the day.
export const COMPANY_TICKERS_TTL_MS = 24 * 60 * 60 * 1000;
export const SUBMISSIONS_TTL_MS = 10 * 60 * 1000;

const COMPANY_TICKERS_KEY = 'company-tickers';

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

/**
 * In-memory cache in front of EdgarService. Cache hits never reach SEC or the
 * rate limiter. Only successful responses are cached, and concurrent requests
 * for the same key share one upstream call.
 *
 * TODO: Invalidation. Entries only expire by TTL; add a way to evict a
 * company's submissions early (e.g. when a new filing is known to exist).
 * TODO: Memory limit. Entries are never evicted beyond expiry; cap the number
 * of cached companies (e.g. LRU) before this serves many distinct companies.
 */
@Injectable()
export class CachedEdgarService {
  private readonly entries = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<string, Promise<unknown>>();

  constructor(
    private readonly edgar: EdgarService,
    private readonly cikPadding: CikPaddingService,
  ) {}

  getCompanyTickers(): Promise<EdgarCompanyTickers> {
    return this.cached(COMPANY_TICKERS_KEY, COMPANY_TICKERS_TTL_MS, () =>
      this.edgar.getCompanyTickers(),
    );
  }

  async getSubmissions(cik: number | string): Promise<EdgarSubmissions> {
    // Pad so that 320193 and "0000320193" share one entry.
    const paddedCik = this.cikPadding.pad(cik);
    return this.cached(`submissions:${paddedCik}`, SUBMISSIONS_TTL_MS, () =>
      this.edgar.getSubmissions(paddedCik),
    );
  }

  private cached<T>(
    key: string,
    ttlMs: number,
    load: () => Promise<T>,
  ): Promise<T> {
    const entry = this.entries.get(key);
    if (entry && Date.now() < entry.expiresAt) {
      return Promise.resolve(entry.value as T);
    }

    let pending = this.inFlight.get(key) as Promise<T> | undefined;
    if (!pending) {
      pending = load()
        .then((value) => {
          this.entries.set(key, { value, expiresAt: Date.now() + ttlMs });
          return value;
        })
        .finally(() => this.inFlight.delete(key));
      this.inFlight.set(key, pending);
    }
    return pending;
  }
}
