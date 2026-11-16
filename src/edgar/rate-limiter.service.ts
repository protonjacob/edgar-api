import { Inject, Injectable, Optional } from '@nestjs/common';

export interface RateLimitOptions {
  maxRequests: number;
  intervalMs: number;
}

// SEC allows 10 requests per second; we stay well below that.
export const EDGAR_RATE_LIMIT: RateLimitOptions = {
  maxRequests: 7,
  intervalMs: 1000,
};

export const RATE_LIMIT_OPTIONS = Symbol('RATE_LIMIT_OPTIONS');

/**
 * Sliding-window rate limiter. Tasks beyond the limit are queued (FIFO) and
 * started as soon as a slot in the window frees up; they are never rejected.
 */
@Injectable()
export class RateLimiterService {
  private readonly options: RateLimitOptions;
  private readonly startTimes: number[] = [];
  private readonly queue: Array<() => void> = [];
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    @Optional() @Inject(RATE_LIMIT_OPTIONS) options?: RateLimitOptions,
  ) {
    this.options = options ?? EDGAR_RATE_LIMIT;
  }

  schedule<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(() => {
        try {
          task().then(resolve, reject);
        } catch (error) {
          reject(error);
        }
      });
      this.drain();
    });
  }

  private drain(): void {
    if (this.timer) {
      return;
    }

    const { maxRequests, intervalMs } = this.options;
    const now = Date.now();

    while (
      this.startTimes.length > 0 &&
      this.startTimes[0] <= now - intervalMs
    ) {
      this.startTimes.shift();
    }

    while (this.queue.length > 0 && this.startTimes.length < maxRequests) {
      this.startTimes.push(now);
      this.queue.shift()!();
    }

    if (this.queue.length > 0) {
      const waitMs = this.startTimes[0] + intervalMs - now;
      this.timer = setTimeout(() => {
        this.timer = undefined;
        this.drain();
      }, waitMs);
    }
  }
}
