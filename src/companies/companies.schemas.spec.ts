import {
  accessionNumberSchema,
  filingsQuerySchema,
} from './companies.schemas.js';

describe('filingsQuerySchema', () => {
  it('splits comma-separated and repeated form types, dropping blanks', () => {
    const result = filingsQuerySchema.parse({
      'form-type': ['10-K, 8-K', '', '10-K/A'],
    });

    expect(result.filters.formTypes).toEqual(['10-K', '8-K', '10-K/A']);
  });

  it('accepts a valid inclusive date range', () => {
    expect(
      filingsQuerySchema.parse({
        'start-date': '2024-01-01',
        'end-date': '2024-01-01',
      }).filters,
    ).toEqual({
      formTypes: undefined,
      startDate: '2024-01-01',
      endDate: '2024-01-01',
    });
  });

  it('defaults to a page of 50 without a cursor', () => {
    expect(filingsQuerySchema.parse({}).page).toEqual({
      limit: 50,
      cursor: undefined,
    });
  });

  it('accepts a limit between 1 and 200 and passes the cursor through', () => {
    expect(filingsQuerySchema.parse({ limit: '1' }).page.limit).toBe(1);
    expect(
      filingsQuerySchema.parse({ limit: '200', cursor: 'abc' }).page,
    ).toEqual({ limit: 200, cursor: 'abc' });
  });

  it.each(['0', '201', '-1', '1.5', 'ten', ''])('rejects limit %s', (limit) => {
    const result = filingsQuerySchema.safeParse({ limit });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe(
      'limit must be an integer between 1 and 200',
    );
  });

  it('rejects an empty cursor', () => {
    expect(filingsQuerySchema.safeParse({ cursor: '' }).success).toBe(false);
  });

  it.each(['2024-1-01', '20240101', '2024-02-30', '2023-02-29', '2024-13-01'])(
    'rejects invalid date %s',
    (date) => {
      expect(filingsQuerySchema.safeParse({ 'start-date': date }).success).toBe(
        false,
      );
    },
  );

  it('accepts a leap day', () => {
    expect(
      filingsQuerySchema.safeParse({ 'start-date': '2024-02-29' }).success,
    ).toBe(true);
  });

  it('rejects a start date after the end date', () => {
    const result = filingsQuerySchema.safeParse({
      'start-date': '2024-02-01',
      'end-date': '2024-01-01',
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe(
      'start-date must not be after end-date',
    );
  });
});

describe('accessionNumberSchema', () => {
  it.each(['0000320193-24-000123', '000032019324000123'])(
    'normalizes %s to the dashed form',
    (value) => {
      expect(accessionNumberSchema.parse(value)).toBe('0000320193-24-000123');
    },
  );

  it.each(['abc', '0000320193-24-00012', '0000320193_24_000123'])(
    'rejects %s',
    (value) => {
      expect(accessionNumberSchema.safeParse(value).success).toBe(false);
    },
  );
});
