import { NotFoundException } from '@nestjs/common';
import type { CachedEdgarService } from '../edgar/cached-edgar.service.js';
import { TickerCikService } from './ticker-cik.service.js';

describe('TickerCikService', () => {
  let getCompanyTickers: ReturnType<typeof vi.fn>;
  let service: TickerCikService;

  beforeEach(() => {
    getCompanyTickers = vi.fn().mockResolvedValue({
      '0': { cik_str: 320193, ticker: 'AAPL', title: 'Apple Inc.' },
      '1': { cik_str: 1067983, ticker: 'BRK-B', title: 'BERKSHIRE HATHAWAY' },
    });
    service = new TickerCikService({
      getCompanyTickers,
    } as unknown as CachedEdgarService);
  });

  it('resolves a ticker regardless of case', async () => {
    const expected = { cik: 320193, ticker: 'AAPL', name: 'Apple Inc.' };

    await expect(service.resolve('AAPL')).resolves.toEqual(expected);
    await expect(service.resolve('aapl')).resolves.toEqual(expected);
    await expect(service.resolve('brk-b')).resolves.toMatchObject({
      cik: 1067983,
    });
  });

  it('throws NotFoundException for an unknown ticker', async () => {
    await expect(service.resolve('NOPE')).rejects.toThrow(
      new NotFoundException("Company with ticker 'NOPE' not found"),
    );
  });
});
