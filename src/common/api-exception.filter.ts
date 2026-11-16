import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { EdgarUpstreamError } from '../edgar/edgar-upstream.error.js';
import { ApiError, ApiResponse } from './api-response.js';

/**
 * Converts every thrown error into the API response envelope, mirroring the
 * error status as the HTTP status code.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const error = this.toApiError(exception);
    const body: ApiResponse<null> = { data: null, error, status: error.status };

    host.switchToHttp().getResponse<Response>().status(error.status).json(body);
  }

  private toApiError(exception: unknown): ApiError {
    // SEC errors are forwarded to the caller as-is.
    if (exception instanceof EdgarUpstreamError) {
      return { message: exception.message, status: exception.status };
    }

    if (exception instanceof HttpException) {
      return {
        message: this.httpExceptionMessage(exception),
        status: exception.getStatus(),
      };
    }

    this.logger.error(
      'Unhandled exception',
      exception instanceof Error ? exception.stack : String(exception),
    );
    return {
      message: 'Internal server error',
      status: HttpStatus.INTERNAL_SERVER_ERROR,
    };
  }

  private httpExceptionMessage(exception: HttpException): string {
    const response = exception.getResponse();
    if (typeof response === 'string') {
      return response;
    }

    // Validation pipes report a list of messages; join them into one string.
    const message = (response as { message?: unknown }).message;
    if (Array.isArray(message)) {
      return message.join('; ');
    }
    return typeof message === 'string' ? message : exception.message;
  }
}
