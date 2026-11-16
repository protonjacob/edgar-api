import { Module } from '@nestjs/common';
import { EdgarModule } from '../edgar/edgar.module.js';
import { CompaniesController } from './companies.controller.js';
import { CompaniesService } from './companies.service.js';
import { TickerCikService } from './ticker-cik.service.js';

@Module({
  imports: [EdgarModule],
  controllers: [CompaniesController],
  providers: [CompaniesService, TickerCikService],
})
export class CompaniesModule {}
