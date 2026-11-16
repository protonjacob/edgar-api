import { z } from 'zod';

const ACCESSION_NUMBER = /^(\d{10})-?(\d{2})-?(\d{6})$/;

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
  })
  .refine(
    (query) =>
      query['start-date'] === undefined ||
      query['end-date'] === undefined ||
      query['start-date'] <= query['end-date'],
    { message: 'start-date must not be after end-date' },
  )
  .transform((query) => ({
    formTypes: query['form-type'],
    startDate: query['start-date'],
    endDate: query['end-date'],
  }));

/** Accepts dashed or undashed accession numbers and normalizes to dashed. */
export const accessionNumberSchema = z
  .string()
  .regex(
    ACCESSION_NUMBER,
    'accession number must look like 0000320193-24-000123',
  )
  .transform((value) => value.replace(ACCESSION_NUMBER, '$1-$2-$3'));
