import { Module } from '@nestjs/common';
import { CachedEdgarService } from './cached-edgar.service.js';
import { CikPaddingService } from './cik-padding.service.js';
import { EdgarService } from './edgar.service.js';
import { RateLimiterService } from './rate-limiter.service.js';

// Consumers use CachedEdgarService; EdgarService is only reached on a miss.
@Module({
  providers: [
    CachedEdgarService,
    EdgarService,
    CikPaddingService,
    RateLimiterService,
  ],
  exports: [CachedEdgarService, CikPaddingService],
})
export class EdgarModule {}
