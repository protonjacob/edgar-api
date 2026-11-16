import { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { ResponseEnvelopeInterceptor } from './response-envelope.interceptor.js';

describe('ResponseEnvelopeInterceptor', () => {
  const context = {
    switchToHttp: () => ({ getResponse: () => ({ statusCode: 200 }) }),
  } as unknown as ExecutionContext;
  const interceptor = new ResponseEnvelopeInterceptor();

  const run = (value: unknown) =>
    firstValueFrom(
      interceptor.intercept(context, {
        handle: () => of(value),
      } as CallHandler),
    );

  it('wraps the handler result with the response status', async () => {
    await expect(run({ ticker: 'AAPL' })).resolves.toEqual({
      data: { ticker: 'AAPL' },
      error: null,
      status: 200,
    });
  });

  it('turns an undefined result into null data', async () => {
    await expect(run(undefined)).resolves.toEqual({
      data: null,
      error: null,
      status: 200,
    });
  });
});
