import {
  ArgumentsHost,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EdgarUpstreamError } from '../edgar/edgar-upstream.error.js';
import { ApiExceptionFilter } from './api-exception.filter.js';

describe('ApiExceptionFilter', () => {
  let status: ReturnType<typeof vi.fn>;
  let json: ReturnType<typeof vi.fn>;
  let host: ArgumentsHost;
  const filter = new ApiExceptionFilter();

  beforeEach(() => {
    json = vi.fn();
    status = vi.fn().mockReturnValue({ json });
    host = {
      switchToHttp: () => ({ getResponse: () => ({ status }) }),
    } as unknown as ArgumentsHost;
  });

  const expectResponse = (code: number, message: string) => {
    expect(status).toHaveBeenCalledWith(code);
    expect(json).toHaveBeenCalledWith({
      data: null,
      error: { message, status: code },
      status: code,
    });
  };

  it('wraps HTTP exceptions', () => {
    filter.catch(new NotFoundException('Not here'), host);

    expectResponse(404, 'Not here');
  });

  it('joins validation messages into one string', () => {
    filter.catch(new BadRequestException(['first', 'second']), host);

    expectResponse(400, 'first; second');
  });

  it('forwards SEC errors with their status and message', () => {
    filter.catch(new EdgarUpstreamError(503, 'SEC is unavailable'), host);

    expectResponse(503, 'SEC is unavailable');
  });

  it('hides unknown errors behind a 500', () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    filter.catch(new Error('secret details'), host);

    expectResponse(500, 'Internal server error');
  });
});
