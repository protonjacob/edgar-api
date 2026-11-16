import { Module, StandardSchemaValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ApiExceptionFilter } from './common/api-exception.filter.js';
import { ResponseEnvelopeInterceptor } from './common/response-envelope.interceptor.js';
import { CompaniesModule } from './companies/companies.module.js';

@Module({
  imports: [CompaniesModule],
  providers: [
    { provide: APP_PIPE, useClass: StandardSchemaValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})
export class AppModule {}
