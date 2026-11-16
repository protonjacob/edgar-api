import { BadRequestException } from '@nestjs/common';
import type { Filing, FilingFilters } from './filing.js';

/** Where a page ended, in the list's newest-first order. */
export type FilingPosition = Pick<Filing, 'filingDate' | 'accessionNumber'>;

interface CursorPayload {
  filingDate: string;
  accessionNumber: string;
  filters: string;
}

const INVALID_CURSOR =
  'cursor is invalid; pass the nextCursor value from a previous response unchanged';
const FILTERS_CHANGED =
  'cursor does not match the current filters (form-type, start-date, end-date); ' +
  'repeat the filters used for the first page, or start again without a cursor';

/**
 * Cursors are opaque to clients: base64url-encoded JSON holding the last
 * position returned plus the filters that produced the page, so a cursor
 * cannot silently be reused with different filters.
 */
export function encodeFilingCursor(
  position: FilingPosition,
  filters: FilingFilters,
): string {
  const payload: CursorPayload = {
    filingDate: position.filingDate,
    accessionNumber: position.accessionNumber,
    filters: canonicalFilters(filters),
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

/** @throws BadRequestException when the cursor is malformed or the filters changed. */
export function decodeFilingCursor(
  cursor: string,
  filters: FilingFilters,
): FilingPosition {
  const payload = parse(cursor);
  if (!payload) {
    throw new BadRequestException(INVALID_CURSOR);
  }
  if (payload.filters !== canonicalFilters(filters)) {
    throw new BadRequestException(FILTERS_CHANGED);
  }
  return {
    filingDate: payload.filingDate,
    accessionNumber: payload.accessionNumber,
  };
}

function parse(cursor: string): CursorPayload | undefined {
  try {
    const value: unknown = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    );
    return isCursorPayload(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

function isCursorPayload(value: unknown): value is CursorPayload {
  const candidate = value as Partial<CursorPayload> | null;
  return (
    typeof candidate?.filingDate === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(candidate.filingDate) &&
    typeof candidate.accessionNumber === 'string' &&
    /^\d{10}-\d{2}-\d{6}$/.test(candidate.accessionNumber) &&
    typeof candidate.filters === 'string'
  );
}

// Equivalent filters must compare equal: form types match case-insensitively
// and their order does not matter.
function canonicalFilters(filters: FilingFilters): string {
  const formTypes = [
    ...new Set(filters.formTypes?.map((type) => type.toUpperCase())),
  ].sort();
  return JSON.stringify([
    formTypes,
    filters.startDate ?? null,
    filters.endDate ?? null,
  ]);
}
