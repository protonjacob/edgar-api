import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { CachedEdgarService } from '../edgar/cached-edgar.service.js';
import type { EdgarRecentFilings } from '../edgar/edgar.types.js';
import { CompaniesService } from './companies.service.js';
import type { FilingFilters } from './filing.js';
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
      { getSubmissions } as unknown as CachedEdgarService,
    );
  });

  // Filtering and ordering tests look at the items of a single page.
  const listItems = async (ticker: string, filters: FilingFilters) =>
    (await service.listFilings(ticker, filters)).items;

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
      const filings = await listItems('AAPL', {});

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
      const filings = await listItems('AAPL', { formTypes: ['4'] });

      expect(filings[0].reportDate).toBeNull();
    });

    it('orders newest first, breaking ties by accession number', async () => {
      const filings = await listItems('AAPL', {});

      expect(accessions(filings)).toEqual(['5', '3', '2', '4', '1']);
    });

    it('matches form types case-insensitively', async () => {
      const filings = await listItems('AAPL', {
        formTypes: ['10-Q', '8-k'],
      });

      expect(accessions(filings)).toEqual(['3', '2']);
    });

    it('excludes amendments unless requested explicitly', async () => {
      const without = await listItems('AAPL', {
        formTypes: ['10-K'],
      });
      const withAmendment = await listItems('AAPL', {
        formTypes: ['10-K', '10-K/A'],
      });

      expect(accessions(without)).toEqual(['1']);
      expect(accessions(withAmendment)).toEqual(['4', '1']);
    });

    it('filters on filing date with inclusive bounds', async () => {
      const filings = await listItems('AAPL', {
        startDate: '2024-02-01',
        endDate: '2024-03-01',
      });

      expect(accessions(filings)).toEqual(['3', '2', '4']);
    });

    it('ignores the report date when filtering by date', async () => {
      // Filing 1 was filed 2024-01-10 for a period ending 2023-12-31.
      const filings = await listItems('AAPL', {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      });

      expect(accessions(filings)).toEqual(['1']);
    });

    it('supports open-ended date ranges', async () => {
      const from = await listItems('AAPL', {
        startDate: '2024-03-01',
      });
      const until = await listItems('AAPL', {
        endDate: '2024-01-10',
      });

      expect(accessions(from)).toEqual(['5', '3', '2']);
      expect(accessions(until)).toEqual(['1']);
    });

    it('includes filings without a report date when filtering by date', async () => {
      const filings = await listItems('AAPL', {
        startDate: '2024-04-01',
      });

      expect(accessions(filings)).toEqual(['5']);
    });
  });

  describe('listFilings paging', () => {
    const pageOf = (filters: FilingFilters, limit: number, cursor?: string) =>
      service.listFilings('AAPL', filters, { limit, cursor });

    const allPages = async (filters: FilingFilters, limit: number) => {
      const pages = [await pageOf(filters, limit)];
      while (pages.at(-1)!.nextCursor) {
        pages.push(await pageOf(filters, limit, pages.at(-1)!.nextCursor!));
      }
      return pages;
    };

    it('returns the first page with the total and a cursor for the next', async () => {
      const page = await pageOf({}, 2);

      expect(accessions(page.items)).toEqual(['5', '3']);
      expect(page).toMatchObject({ limit: 2, total: 5 });
      expect(page.nextCursor).toEqual(expect.any(String));
    });

    it('walks every filing exactly once, ending with a null cursor', async () => {
      const pages = await allPages({}, 2);

      expect(pages.map((page) => accessions(page.items))).toEqual([
        ['5', '3'],
        ['2', '4'],
        ['1'],
      ]);
      expect(pages.at(-1)!.nextCursor).toBeNull();
    });

    it('counts and pages only the filings that match the filters', async () => {
      const pages = await allPages({ formTypes: ['10-K', '10-K/A'] }, 1);

      expect(pages.map((page) => page.total)).toEqual([2, 2]);
      expect(pages.flatMap((page) => accessions(page.items))).toEqual([
        '4',
        '1',
      ]);
    });

    it('has no next cursor when everything fits on one page', async () => {
      await expect(pageOf({}, 5)).resolves.toMatchObject({
        total: 5,
        nextCursor: null,
      });
    });

    it('returns an empty page when nothing matches', async () => {
      await expect(pageOf({ formTypes: ['S-1'] }, 2)).resolves.toEqual({
        items: [],
        limit: 2,
        total: 0,
        nextCursor: null,
      });
    });

    it('neither repeats nor skips filings when new ones arrive between pages', async () => {
      const first = await pageOf({}, 2);
      getSubmissions.mockResolvedValue({
        filings: {
          recent: {
            accessionNumber: [
              '0000320193-24-000009',
              ...recent.accessionNumber,
            ],
            filingDate: ['2024-05-01', ...recent.filingDate],
            reportDate: ['2024-04-30', ...recent.reportDate],
            form: ['8-K', ...recent.form],
            primaryDocument: ['new.htm', ...recent.primaryDocument],
          },
        },
      });

      const second = await pageOf({}, 2, first.nextCursor!);

      expect(accessions(second.items)).toEqual(['2', '4']);
      expect(second.total).toBe(6);
    });

    it('continues after the cursor position even if that filing is gone', async () => {
      const first = await pageOf({}, 2);
      getSubmissions.mockResolvedValue({
        filings: {
          recent: {
            accessionNumber: recent.accessionNumber.slice(0, 1),
            filingDate: recent.filingDate.slice(0, 1),
            reportDate: recent.reportDate.slice(0, 1),
            form: recent.form.slice(0, 1),
            primaryDocument: recent.primaryDocument.slice(0, 1),
          },
        },
      });

      const second = await pageOf({}, 2, first.nextCursor!);

      expect(accessions(second.items)).toEqual(['1']);
    });

    it('accepts a cursor with equivalent filters in another case or order', async () => {
      const first = await pageOf({ formTypes: ['10-K', '10-q'] }, 1);

      const second = await pageOf(
        { formTypes: ['10-Q', '10-k'] },
        1,
        first.nextCursor!,
      );

      expect(accessions(second.items)).toEqual(['1']);
    });

    it.each<[string, FilingFilters]>([
      ['form types', { formTypes: ['8-K'] }],
      ['start date', { startDate: '2020-01-01' }],
      ['end date', { endDate: '2030-01-01' }],
    ])(
      'rejects a cursor when the %s changed, explaining why',
      async (_, changed) => {
        const first = await pageOf({}, 2);

        const result = pageOf(changed, 2, first.nextCursor!);

        await expect(result).rejects.toBeInstanceOf(BadRequestException);
        await expect(result).rejects.toThrow(
          /cursor does not match the current filters/,
        );
      },
    );

    it.each([
      'not-a-cursor',
      'e30',
      Buffer.from('{"x":1}').toString('base64url'),
    ])('rejects malformed cursor %s without calling SEC', async (cursor) => {
      const result = pageOf({}, 2, cursor);

      await expect(result).rejects.toBeInstanceOf(BadRequestException);
      await expect(result).rejects.toThrow(/cursor is invalid/);
      expect(getSubmissions).not.toHaveBeenCalled();
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
