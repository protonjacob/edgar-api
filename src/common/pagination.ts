/** One page of results, as produced by a service. */
export interface Page<T> {
  items: T[];
  limit: number;
  /** Number of results across all pages. */
  total: number;
  /** Opaque cursor for the next page, or null on the last page. */
  nextCursor: string | null;
}

/** The `data` of a paginated response. */
export interface Paginated<T> {
  items: T[];
  pagination: {
    limit: number;
    total: number;
    nextCursor: string | null;
    /** Relative URL of the next page, or null on the last page. */
    next: string | null;
  };
}

/**
 * Wraps a page for the response. `next` repeats the current request with the
 * cursor replaced, so clients keep their filters and limit without rebuilding
 * the URL.
 */
export function toPaginated<T>(
  page: Page<T>,
  requestUrl: string,
): Paginated<T> {
  return {
    items: page.items,
    pagination: {
      limit: page.limit,
      total: page.total,
      nextCursor: page.nextCursor,
      next: page.nextCursor && withCursor(requestUrl, page.nextCursor),
    },
  };
}

function withCursor(requestUrl: string, cursor: string): string {
  // The base only lets URL parse a relative path; it never ends up in the result.
  const url = new URL(requestUrl, 'http://localhost');
  url.searchParams.set('cursor', cursor);
  return `${url.pathname}${url.search}`;
}
