import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/configure-app.js';
import { EdgarUpstreamError } from './../src/edgar/edgar-upstream.error.js';
import { EdgarService } from './../src/edgar/edgar.service.js';

const fakeEdgarService = {
  getCompanyTickers: vi.fn(),
  getSubmissions: vi.fn(),
};

const appleSubmissions = {
  cik: '0000320193',
  name: 'Apple Inc.',
  tickers: ['AAPL'],
  filings: {
    recent: {
      accessionNumber: [
        '0000320193-24-000003',
        '0000320193-24-000002',
        '0000320193-24-000001',
      ],
      filingDate: ['2024-08-02', '2024-05-03', '2023-11-03'],
      reportDate: ['2024-06-29', '2024-05-02', '2023-09-30'],
      form: ['10-Q', '8-K', '10-K'],
      primaryDocument: ['aapl-10q.htm', 'aapl-8k.htm', 'aapl-10k.htm'],
    },
  },
};

describe('Companies API (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    fakeEdgarService.getCompanyTickers.mockResolvedValue({
      '0': { cik_str: 320193, ticker: 'AAPL', title: 'Apple Inc.' },
    });
    fakeEdgarService.getSubmissions.mockResolvedValue(appleSubmissions);

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EdgarService)
      .useValue(fakeEdgarService)
      .compile();

    app = moduleFixture.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    vi.resetAllMocks();
    await app.close();
  });

  const get = (path: string) => request(app.getHttpServer()).get(path);

  it('GET /api/companies/:ticker returns the company', async () => {
    const res = await get('/api/companies/aapl').expect(200);

    expect(res.body).toEqual({
      data: { cik: 320193, ticker: 'AAPL', name: 'Apple Inc.' },
      error: null,
      status: 200,
    });
  });

  it('GET /api/companies/:ticker returns 404 for an unknown ticker', async () => {
    const res = await get('/api/companies/NOPE').expect(404);

    expect(res.body).toEqual({
      data: null,
      error: { message: "Company with ticker 'NOPE' not found", status: 404 },
      status: 404,
    });
  });

  it('GET /api/companies/:ticker/filings lists all filings newest first', async () => {
    const res = await get('/api/companies/AAPL/filings').expect(200);

    expect(res.body.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data.map((f: { formType: string }) => f.formType)).toEqual([
      '10-Q',
      '8-K',
      '10-K',
    ]);
    expect(res.body.data[2]).toEqual({
      accessionNumber: '0000320193-24-000001',
      formType: '10-K',
      filingDate: '2023-11-03',
      reportDate: '2023-09-30',
      primaryDocumentUrl:
        'https://www.sec.gov/Archives/edgar/data/320193/000032019324000001/aapl-10k.htm',
    });
  });

  it('GET /api/companies/:ticker/filings applies form type and date filters', async () => {
    const res = await get(
      '/api/companies/AAPL/filings?form-type=10-k,8-K&form-type=4&start-date=2024-01-01&end-date=2024-05-02',
    ).expect(200);

    expect(
      res.body.data.map((f: { accessionNumber: string }) => f.accessionNumber),
    ).toEqual(['0000320193-24-000002']);
  });

  it('GET /api/companies/:ticker/filings returns 400 for an invalid date', async () => {
    const res = await get(
      '/api/companies/AAPL/filings?start-date=2024-02-30',
    ).expect(400);

    expect(res.body.data).toBeNull();
    expect(res.body.status).toBe(400);
    expect(res.body.error.status).toBe(400);
    expect(res.body.error.message).toContain(
      'start-date must be a valid calendar date',
    );
  });

  it('GET /api/companies/:ticker/filings returns 400 when start is after end', async () => {
    const res = await get(
      '/api/companies/AAPL/filings?start-date=2024-02-01&end-date=2024-01-01',
    ).expect(400);

    expect(res.body.error.message).toContain(
      'start-date must not be after end-date',
    );
  });

  it('GET /api/companies/:ticker/filings/:accessionNumber returns the filing', async () => {
    const res = await get(
      '/api/companies/AAPL/filings/000032019324000002',
    ).expect(200);

    expect(res.body).toMatchObject({
      data: { accessionNumber: '0000320193-24-000002', formType: '8-K' },
      error: null,
      status: 200,
    });
  });

  it('GET /api/companies/:ticker/filings/:accessionNumber returns 404 for an unknown filing', async () => {
    const res = await get(
      '/api/companies/AAPL/filings/0000320193-24-999999',
    ).expect(404);

    expect(res.body.error.status).toBe(404);
  });

  it('GET /api/companies/:ticker/filings/:accessionNumber returns 400 for a malformed accession number', async () => {
    const res = await get('/api/companies/AAPL/filings/not-a-number').expect(
      400,
    );

    expect(res.body.error.status).toBe(400);
  });

  it('GET /api/companies/:ticker/filings returns an empty list when nothing matches', async () => {
    const res = await get('/api/companies/AAPL/filings?form-type=S-1').expect(
      200,
    );

    expect(res.body).toEqual({ data: [], error: null, status: 200 });
  });

  it.each(['form-type=', 'form-type=,', 'form-type=%20,%20'])(
    'GET /api/companies/:ticker/filings treats blank %s as no filter',
    async (query) => {
      const res = await get(`/api/companies/AAPL/filings?${query}`).expect(200);

      expect(res.body.data).toHaveLength(3);
    },
  );

  it('GET /api/companies/:ticker/filings/:accessionNumber resolves the ticker regardless of case', async () => {
    const res = await get(
      '/api/companies/aApL/filings/0000320193-24-000002',
    ).expect(200);

    expect(res.body.data.accessionNumber).toBe('0000320193-24-000002');
  });

  it.each([
    '/api/companies/NOPE/filings',
    '/api/companies/NOPE/filings/0000320193-24-000002',
  ])('GET %s returns 404 for an unknown ticker', async (path) => {
    const res = await get(path).expect(404);

    expect(res.body).toEqual({
      data: null,
      error: { message: "Company with ticker 'NOPE' not found", status: 404 },
      status: 404,
    });
  });

  describe('forwards SEC errors to the caller', () => {
    it.each([
      [404, 'The specified key does not exist.'],
      [500, 'Internal Server Error'],
      [502, 'Failed to reach SEC: fetch failed'],
    ])('from the filings list (%i)', async (status, message) => {
      fakeEdgarService.getSubmissions.mockRejectedValue(
        new EdgarUpstreamError(status, message),
      );

      const res = await get('/api/companies/AAPL/filings').expect(status);

      expect(res.body).toEqual({
        data: null,
        error: { message, status },
        status,
      });
    });

    it('from the single filing lookup', async () => {
      fakeEdgarService.getSubmissions.mockRejectedValue(
        new EdgarUpstreamError(503, 'Service Unavailable'),
      );

      const res = await get(
        '/api/companies/AAPL/filings/0000320193-24-000002',
      ).expect(503);

      expect(res.body).toEqual({
        data: null,
        error: { message: 'Service Unavailable', status: 503 },
        status: 503,
      });
    });

    it.each([
      '/api/companies/AAPL',
      '/api/companies/AAPL/filings',
      '/api/companies/AAPL/filings/0000320193-24-000002',
    ])('from the ticker list lookup on %s', async (path) => {
      fakeEdgarService.getCompanyTickers.mockRejectedValue(
        new EdgarUpstreamError(403, 'Forbidden'),
      );

      const res = await get(path).expect(403);

      expect(res.body).toEqual({
        data: null,
        error: { message: 'Forbidden', status: 403 },
        status: 403,
      });
    });
  });

  it('wraps unknown routes in the response envelope', async () => {
    const res = await get('/api/nothing-here').expect(404);

    expect(res.body.data).toBeNull();
    expect(res.body.status).toBe(404);
    expect(res.body.error.status).toBe(404);
  });
});
