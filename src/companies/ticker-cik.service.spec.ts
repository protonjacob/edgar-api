import { NotFoundException } from '@nestjs/common';
import type { EdgarService } from '../edgar/edgar.service.js';
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
    } as unknown as EdgarService);
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it('caches the ticker list between calls', async () => {
    await service.resolve('AAPL');
    await service.resolve('BRK-B');

    expect(getCompanyTickers).toHaveBeenCalledTimes(1);
  });

  it('shares one load between concurrent calls', async () => {
    await Promise.all([service.resolve('AAPL'), service.resolve('aapl')]);

    expect(getCompanyTickers).toHaveBeenCalledTimes(1);
  });

  it('reloads the ticker list after 24 hours', async () => {
    vi.useFakeTimers();
    await service.resolve('AAPL');

    vi.advanceTimersByTime(24 * 60 * 60 * 1000);
    await service.resolve('AAPL');

    expect(getCompanyTickers).toHaveBeenCalledTimes(2);
  });

  it('retries the load after a failure', async () => {
    getCompanyTickers.mockRejectedValueOnce(new Error('boom'));

    await expect(service.resolve('AAPL')).rejects.toThrow('boom');
    await expect(service.resolve('AAPL')).resolves.toMatchObject({
      cik: 320193,
    });
  });
});
