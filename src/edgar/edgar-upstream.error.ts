/** An error returned by, or while talking to, SEC EDGAR. */
export class EdgarUpstreamError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'EdgarUpstreamError';
  }
}
