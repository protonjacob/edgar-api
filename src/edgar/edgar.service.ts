import { Injectable } from '@nestjs/common';
import { CikPaddingService } from './cik-padding.service.js';
import { EdgarUpstreamError } from './edgar-upstream.error.js';
import type { EdgarCompanyTickers, EdgarSubmissions } from './edgar.types.js';
import { RateLimiterService } from './rate-limiter.service.js';

// SEC requires a declared User-Agent of the form "<app name> <contact email>".
export const EDGAR_USER_AGENT = 'edgar-api admin@example.com';

export const COMPANY_TICKERS_URL =
  'https://www.sec.gov/files/company_tickers.json';
export const SUBMISSIONS_BASE_URL = 'https://data.sec.gov/submissions';

const BAD_GATEWAY = 502;
const MAX_ERROR_MESSAGE_LENGTH = 200;

/** The only place that talks to SEC EDGAR. Every request is rate limited. */
@Injectable()
export class EdgarService {
  constructor(
    private readonly rateLimiter: RateLimiterService,
    private readonly cikPadding: CikPaddingService,
  ) {}

  getCompanyTickers(): Promise<EdgarCompanyTickers> {
    return this.getJson<EdgarCompanyTickers>(COMPANY_TICKERS_URL);
  }

  async getSubmissions(cik: number | string): Promise<EdgarSubmissions> {
    const paddedCik = this.cikPadding.pad(cik);
    return this.getJson<EdgarSubmissions>(
      `${SUBMISSIONS_BASE_URL}/CIK${paddedCik}.json`,
    );
  }

  private getJson<T>(url: string): Promise<T> {
    return this.rateLimiter.schedule(async () => {
      let response: Response;
      try {
        response = await fetch(url, {
          headers: {
            'User-Agent': EDGAR_USER_AGENT,
            Accept: 'application/json',
          },
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new EdgarUpstreamError(
          BAD_GATEWAY,
          `Failed to reach SEC EDGAR: ${reason}`,
        );
      }

      if (!response.ok) {
        throw new EdgarUpstreamError(
          response.status,
          await this.readErrorMessage(response),
        );
      }

      try {
        return (await response.json()) as T;
      } catch {
        throw new EdgarUpstreamError(
          BAD_GATEWAY,
          'SEC EDGAR returned an invalid JSON response',
        );
      }
    });
  }

  private async readErrorMessage(response: Response): Promise<string> {
    const fallback =
      response.statusText ||
      `SEC EDGAR request failed with status ${response.status}`;
    const body = (await response.text().catch(() => '')).trim();

    // Missing documents come back as S3-style XML: <Error><Message>...</Message></Error>
    const xmlMessage = /<Message>([\s\S]*?)<\/Message>/.exec(body)?.[1]?.trim();
    if (xmlMessage) {
      return xmlMessage;
    }

    // Other markup (e.g. HTML error pages) is noise to an API consumer.
    if (!body || body.startsWith('<')) {
      return fallback;
    }

    return body.length > MAX_ERROR_MESSAGE_LENGTH
      ? `${body.slice(0, MAX_ERROR_MESSAGE_LENGTH)}...`
      : body;
  }
}
