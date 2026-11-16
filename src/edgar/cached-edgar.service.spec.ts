import {
  CachedEdgarService,
  COMPANY_TICKERS_TTL_MS,
  SUBMISSIONS_TTL_MS,
} from './cached-edgar.service.js';
import { CikPaddingService } from './cik-padding.service.js';
import { EdgarUpstreamError } from './edgar-upstream.error.js';
import type { EdgarService } from './edgar.service.js';

describe('CachedEdgarService', () => {
  const tickers = {
    '0': { cik_str: 320193, ticker: 'AAPL', title: 'Apple Inc.' },
  };
  const submissions = { cik: '0000320193', name: 'Apple Inc.' };

  let getCompanyTickers: ReturnType<typeof vi.fn>;
  let getSubmissions: ReturnType<typeof vi.fn>;
  let service: CachedEdgarService;

  beforeEach(() => {
    vi.useFakeTimers();
    getCompanyTickers = vi.fn().mockResolvedValue(tickers);
    getSubmissions = vi.fn().mockResolvedValue(submissions);
    service = new CachedEdgarService(
      { getCompanyTickers, getSubmissions } as unknown as EdgarService,
      new CikPaddingService(),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getCompanyTickers', () => {
    it('serves repeat requests from the cache', async () => {
      await expect(service.getCompanyTickers()).resolves.toBe(tickers);
      await expect(service.getCompanyTickers()).resolves.toBe(tickers);

      expect(getCompanyTickers).toHaveBeenCalledTimes(1);
    });

    it('refetches after 24 hours', async () => {
      await service.getCompanyTickers();

      vi.advanceTimersByTime(COMPANY_TICKERS_TTL_MS - 1);
      await service.getCompanyTickers();
      expect(getCompanyTickers).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(1);
      await service.getCompanyTickers();
      expect(getCompanyTickers).toHaveBeenCalledTimes(2);
    });
  });

  describe('getSubmissions', () => {
    it('serves repeat requests for a company from the cache', async () => {
      await expect(service.getSubmissions(320193)).resolves.toBe(submissions);
      await expect(service.getSubmissions('0000320193')).resolves.toBe(
        submissions,
      );

      expect(getSubmissions).toHaveBeenCalledTimes(1);
    });

    it('caches each company separately', async () => {
      await service.getSubmissions(320193);
      await service.getSubmissions(789019);

      expect(getSubmissions).toHaveBeenCalledTimes(2);
    });

    it('refetches after 10 minutes', async () => {
      await service.getSubmissions(320193);

      vi.advanceTimersByTime(SUBMISSIONS_TTL_MS - 1);
      await service.getSubmissions(320193);
      expect(getSubmissions).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(1);
      await service.getSubmissions(320193);
      expect(getSubmissions).toHaveBeenCalledTimes(2);
    });

    it('rejects an invalid CIK without calling SEC', async () => {
      await expect(service.getSubmissions('abc')).rejects.toThrow(
        'Invalid CIK',
      );
      expect(getSubmissions).not.toHaveBeenCalled();
    });
  });

  it('shares one upstream call between concurrent requests', async () => {
    const results = await Promise.all([
      service.getSubmissions(320193),
      service.getSubmissions(320193),
      service.getSubmissions('320193'),
    ]);

    expect(results).toEqual([submissions, submissions, submissions]);
    expect(getSubmissions).toHaveBeenCalledTimes(1);
  });

  it('never caches errors', async () => {
    const error = new EdgarUpstreamError(503, 'Service Unavailable');
    getSubmissions.mockRejectedValueOnce(error);

    await expect(service.getSubmissions(320193)).rejects.toBe(error);
    await expect(service.getSubmissions(320193)).resolves.toBe(submissions);
    expect(getSubmissions).toHaveBeenCalledTimes(2);
  });

  it('shares an upstream error with all concurrent requests', async () => {
    const error = new EdgarUpstreamError(404, 'Not Found');
    getCompanyTickers.mockRejectedValueOnce(error);

    const results = await Promise.allSettled([
      service.getCompanyTickers(),
      service.getCompanyTickers(),
    ]);

    expect(results).toEqual([
      { status: 'rejected', reason: error },
      { status: 'rejected', reason: error },
    ]);
    expect(getCompanyTickers).toHaveBeenCalledTimes(1);
  });
});
