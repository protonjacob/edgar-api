import { z } from 'zod';
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from './filing.js';

const ACCESSION_NUMBER = /^(\d{10})-?(\d{2})-?(\d{6})$/;
const LIMIT_MESSAGE = `limit must be an integer between 1 and ${MAX_PAGE_LIMIT}`;

/** A real calendar date in strict ISO `YYYY-MM-DD` form. */
const isoDate = (name: string) =>
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, `${name} must be in YYYY-MM-DD format`)
    .refine(
      (value) => {
        const date = new Date(`${value}T00:00:00Z`);
        return (
          !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
        );
      },
      { message: `${name} must be a valid calendar date` },
    );

/**
 * Form types may be given comma-separated, as a repeated parameter, or both.
 * Blank entries are ignored.
 */
const formTypes = z
  .union([z.string(), z.array(z.string())])
  .transform((value) =>
    [value]
      .flat()
      .flatMap((entry) => entry.split(','))
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
  );

export const filingsQuerySchema = z
  .object({
    'form-type': formTypes.optional(),
    'start-date': isoDate('start-date').optional(),
    'end-date': isoDate('end-date').optional(),
    limit: z
      .string()
      .regex(/^\d+$/, LIMIT_MESSAGE)
      .transform(Number)
      .refine((n) => n >= 1 && n <= MAX_PAGE_LIMIT, LIMIT_MESSAGE)
      .default(DEFAULT_PAGE_LIMIT),
    cursor: z.string().min(1, 'cursor must not be empty').optional(),
  })
  .refine(
    (query) =>
      query['start-date'] === undefined ||
      query['end-date'] === undefined ||
      query['start-date'] <= query['end-date'],
    { message: 'start-date must not be after end-date' },
  )
  .transform((query) => ({
    filters: {
      formTypes: query['form-type'],
      startDate: query['start-date'],
      endDate: query['end-date'],
    },
    page: { limit: query.limit, cursor: query.cursor },
  }));

/** Accepts dashed or undashed accession numbers and normalizes to dashed. */
export const accessionNumberSchema = z
  .string()
  .regex(
    ACCESSION_NUMBER,
    'accession number must look like 0000320193-24-000123',
  )
  .transform((value) => value.replace(ACCESSION_NUMBER, '$1-$2-$3'));
