import { RateLimiterService } from './rate-limiter.service.js';

describe('RateLimiterService', () => {
  let limiter: RateLimiterService;

  beforeEach(() => {
    vi.useFakeTimers();
    limiter = new RateLimiterService({ maxRequests: 7, intervalMs: 1000 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('defaults to 7 requests per second', async () => {
    const defaultLimiter = new RateLimiterService();
    const task = vi.fn(() => Promise.resolve());

    for (let i = 0; i < 8; i++) {
      void defaultLimiter.schedule(task);
    }

    expect(task).toHaveBeenCalledTimes(7);
    await vi.advanceTimersByTimeAsync(1000);
    expect(task).toHaveBeenCalledTimes(8);
  });

  it('starts up to the limit immediately and delays the rest', async () => {
    const task = vi.fn(() => Promise.resolve());

    for (let i = 0; i < 8; i++) {
      void limiter.schedule(task);
    }

    expect(task).toHaveBeenCalledTimes(7);

    await vi.advanceTimersByTimeAsync(999);
    expect(task).toHaveBeenCalledTimes(7);

    await vi.advanceTimersByTimeAsync(1);
    expect(task).toHaveBeenCalledTimes(8);
  });

  it('frees slots as the window slides', async () => {
    const task = vi.fn(() => Promise.resolve());

    for (let i = 0; i < 3; i++) {
      void limiter.schedule(task);
    }
    await vi.advanceTimersByTimeAsync(500);
    for (let i = 0; i < 5; i++) {
      void limiter.schedule(task);
    }

    // 3 started at t=0, 4 at t=500, 1 waits for the first slot to free at t=1000.
    expect(task).toHaveBeenCalledTimes(7);
    await vi.advanceTimersByTimeAsync(499);
    expect(task).toHaveBeenCalledTimes(7);
    await vi.advanceTimersByTimeAsync(1);
    expect(task).toHaveBeenCalledTimes(8);
  });

  it('runs queued tasks in FIFO order', async () => {
    const order: number[] = [];
    const runs = Array.from({ length: 15 }, (_, i) =>
      limiter.schedule(() => {
        order.push(i);
        return Promise.resolve(i);
      }),
    );

    await vi.advanceTimersByTimeAsync(2000);

    expect(order).toEqual(Array.from({ length: 15 }, (_, i) => i));
    await expect(Promise.all(runs)).resolves.toEqual(order);
  });

  it('counts failed tasks against the limit and keeps running queued tasks', async () => {
    const failing = vi.fn(() => Promise.reject(new Error('boom')));
    const task = vi.fn(() => Promise.resolve());

    const failures = Array.from({ length: 7 }, () =>
      limiter.schedule(failing).catch(() => undefined),
    );
    const queued = limiter.schedule(task);
    await Promise.all(failures);

    expect(failing).toHaveBeenCalledTimes(7);
    expect(task).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);
    expect(task).toHaveBeenCalledTimes(1);
    await expect(queued).resolves.toBeUndefined();
  });

  it('propagates task results and errors', async () => {
    await expect(limiter.schedule(() => Promise.resolve('ok'))).resolves.toBe(
      'ok',
    );
    await expect(
      limiter.schedule(() => Promise.reject(new Error('boom'))),
    ).rejects.toThrow('boom');
    await expect(
      limiter.schedule(() => {
        throw new Error('sync boom');
      }),
    ).rejects.toThrow('sync boom');
  });
});
