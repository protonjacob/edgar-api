import { Module } from '@nestjs/common';
import { CikPaddingService } from './cik-padding.service.js';
import { EdgarService } from './edgar.service.js';
import { RateLimiterService } from './rate-limiter.service.js';

@Module({
  providers: [EdgarService, CikPaddingService, RateLimiterService],
  exports: [EdgarService, CikPaddingService, RateLimiterService],
})
export class EdgarModule {}
