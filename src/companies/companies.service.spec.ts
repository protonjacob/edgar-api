import { NotFoundException } from '@nestjs/common';
import type { EdgarService } from '../edgar/edgar.service.js';
import type { EdgarRecentFilings } from '../edgar/edgar.types.js';
import { CompaniesService } from './companies.service.js';
import type { TickerCikService } from './ticker-cik.service.js';

const apple = { cik: 320193, ticker: 'AAPL', name: 'Apple Inc.' };

// Deliberately not sorted, to check the service orders newest first.
const recent: EdgarRecentFilings = {
  accessionNumber: [
    '0000320193-24-000001',
    '0000320193-24-000003',
    '0000320193-24-000002',
    '0000320193-24-000004',
    '0000320193-24-000005',
  ],
  filingDate: [
    '2024-01-10',
    '2024-03-01',
    '2024-03-01',
    '2024-02-01',
    '2024-04-01',
  ],
  reportDate: ['2023-12-31', '2024-02-28', '2024-02-29', '2023-12-31', ''],
  form: ['10-K', '8-K', '10-q', '10-K/A', '4'],
  primaryDocument: [
    'aapl-10k.htm',
    'aapl-8k.htm',
    'aapl-10q.htm',
    'aapl-10ka.htm',
    'form4.xml',
  ],
};

describe('CompaniesService', () => {
  let resolve: ReturnType<typeof vi.fn>;
  let getSubmissions: ReturnType<typeof vi.fn>;
  let service: CompaniesService;

  beforeEach(() => {
    resolve = vi.fn().mockResolvedValue(apple);
    getSubmissions = vi.fn().mockResolvedValue({
      cik: '0000320193',
      name: 'Apple Inc.',
      tickers: ['AAPL'],
      filings: { recent },
    });
    service = new CompaniesService(
      { resolve } as unknown as TickerCikService,
      { getSubmissions } as unknown as EdgarService,
    );
  });

  const accessions = (filings: { accessionNumber: string }[]) =>
    filings.map((f) => f.accessionNumber.slice(-1));

  describe('getCompany', () => {
    it('returns the resolved company without fetching submissions', async () => {
      await expect(service.getCompany('aapl')).resolves.toEqual(apple);
      expect(resolve).toHaveBeenCalledWith('aapl');
      expect(getSubmissions).not.toHaveBeenCalled();
    });
  });

  describe('listFilings', () => {
    it('maps filings and fetches submissions by CIK', async () => {
      const filings = await service.listFilings('AAPL', {});

      expect(getSubmissions).toHaveBeenCalledWith(320193);
      expect(filings).toContainEqual({
        accessionNumber: '0000320193-24-000001',
        formType: '10-K',
        filingDate: '2024-01-10',
        reportDate: '2023-12-31',
        primaryDocumentUrl:
          'https://www.sec.gov/Archives/edgar/data/320193/000032019324000001/aapl-10k.htm',
      });
    });

    it('turns an empty report date into null', async () => {
      const filings = await service.listFilings('AAPL', { formTypes: ['4'] });

      expect(filings[0].reportDate).toBeNull();
    });

    it('orders newest first, breaking ties by accession number', async () => {
      const filings = await service.listFilings('AAPL', {});

      expect(accessions(filings)).toEqual(['5', '3', '2', '4', '1']);
    });

    it('matches form types case-insensitively', async () => {
      const filings = await service.listFilings('AAPL', {
        formTypes: ['10-Q', '8-k'],
      });

      expect(accessions(filings)).toEqual(['3', '2']);
    });

    it('excludes amendments unless requested explicitly', async () => {
      const without = await service.listFilings('AAPL', {
        formTypes: ['10-K'],
      });
      const withAmendment = await service.listFilings('AAPL', {
        formTypes: ['10-K', '10-K/A'],
      });

      expect(accessions(without)).toEqual(['1']);
      expect(accessions(withAmendment)).toEqual(['4', '1']);
    });

    it('filters on report date with inclusive bounds', async () => {
      const filings = await service.listFilings('AAPL', {
        startDate: '2023-12-31',
        endDate: '2024-02-28',
      });

      expect(accessions(filings)).toEqual(['3', '4', '1']);
    });

    it('supports open-ended date ranges', async () => {
      const from = await service.listFilings('AAPL', {
        startDate: '2024-02-29',
      });
      const until = await service.listFilings('AAPL', {
        endDate: '2023-12-31',
      });

      expect(accessions(from)).toEqual(['2']);
      expect(accessions(until)).toEqual(['4', '1']);
    });

    it('excludes filings without a report date when filtering by date', async () => {
      const filings = await service.listFilings('AAPL', {
        startDate: '2000-01-01',
      });

      expect(accessions(filings)).not.toContain('5');
    });
  });

  describe('getFiling', () => {
    it('returns the matching filing', async () => {
      await expect(
        service.getFiling('AAPL', '0000320193-24-000002'),
      ).resolves.toMatchObject({ formType: '10-q', reportDate: '2024-02-29' });
    });

    it('throws NotFoundException when the company has no such filing', async () => {
      await expect(
        service.getFiling('AAPL', '0000320193-24-999999'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
