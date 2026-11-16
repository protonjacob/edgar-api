import { CikPaddingService } from './cik-padding.service.js';
import { EdgarUpstreamError } from './edgar-upstream.error.js';
import { EDGAR_USER_AGENT, EdgarService } from './edgar.service.js';
import { RateLimiterService } from './rate-limiter.service.js';

describe('EdgarService', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let rateLimiter: RateLimiterService;
  let cikPadding: CikPaddingService;
  let service: EdgarService;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    rateLimiter = new RateLimiterService();
    cikPadding = new CikPaddingService();
    service = new EdgarService(rateLimiter, cikPadding);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const jsonResponse = (body: unknown) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  it('fetches company tickers with the SEC User-Agent', async () => {
    const tickers = {
      '0': { cik_str: 320193, ticker: 'AAPL', title: 'Apple Inc.' },
    };
    fetchMock.mockResolvedValue(jsonResponse(tickers));

    await expect(service.getCompanyTickers()).resolves.toEqual(tickers);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://www.sec.gov/files/company_tickers.json');
    expect(init.headers).toMatchObject({ 'User-Agent': EDGAR_USER_AGENT });
  });

  it('pads the CIK when fetching submissions', async () => {
    const padSpy = vi.spyOn(cikPadding, 'pad');
    fetchMock.mockResolvedValue(jsonResponse({ cik: '0000320193' }));

    await service.getSubmissions(320193);

    expect(padSpy).toHaveBeenCalledWith(320193);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://data.sec.gov/submissions/CIK0000320193.json');
    expect(init.headers).toMatchObject({ 'User-Agent': EDGAR_USER_AGENT });
  });

  it('routes every request through the rate limiter', async () => {
    const scheduleSpy = vi.spyOn(rateLimiter, 'schedule');
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({})));

    await service.getCompanyTickers();
    await service.getSubmissions(1);

    expect(scheduleSpy).toHaveBeenCalledTimes(2);
  });

  it('forwards a 404 with the message extracted from the XML body', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        '<?xml version="1.0" encoding="UTF-8"?>\n<Error><Code>NoSuchKey</Code><Message>The specified key does not exist.</Message><Key>x</Key></Error>',
        { status: 404, statusText: 'Not Found' },
      ),
    );

    const error: unknown = await service
      .getSubmissions(9999999999)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(EdgarUpstreamError);
    expect(error).toMatchObject({
      status: 404,
      message: 'The specified key does not exist.',
    });
  });

  it('forwards a 500 with a plain-text body', async () => {
    fetchMock.mockResolvedValue(
      new Response('Internal failure', {
        status: 500,
        statusText: 'Internal Server Error',
      }),
    );

    await expect(service.getCompanyTickers()).rejects.toMatchObject({
      status: 500,
      message: 'Internal failure',
    });
  });

  it('falls back to the status text for HTML or empty bodies', async () => {
    fetchMock.mockResolvedValue(
      new Response('<html><body>Denied</body></html>', {
        status: 403,
        statusText: 'Forbidden',
      }),
    );

    await expect(service.getCompanyTickers()).rejects.toMatchObject({
      status: 403,
      message: 'Forbidden',
    });
  });

  it('maps network failures to 502', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    await expect(service.getCompanyTickers()).rejects.toMatchObject({
      status: 502,
      message: 'Failed to reach SEC EDGAR: fetch failed',
    });
  });

  it('maps unparseable JSON to 502', async () => {
    fetchMock.mockResolvedValue(new Response('not json', { status: 200 }));

    await expect(service.getCompanyTickers()).rejects.toMatchObject({
      status: 502,
    });
  });

  it('rejects an invalid CIK without calling SEC', async () => {
    await expect(service.getSubmissions('abc')).rejects.toThrow('Invalid CIK');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
