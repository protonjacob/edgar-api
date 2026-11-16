import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { type Paginated, toPaginated } from '../common/pagination.js';
import { CompaniesService } from './companies.service.js';
import {
  accessionNumberSchema,
  filingsQuerySchema,
} from './companies.schemas.js';
import type { Company } from './company.js';
import type { Filing, FilingFilters, PageRequest } from './filing.js';

@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get(':ticker')
  getCompany(@Param('ticker') ticker: string): Promise<Company> {
    return this.companiesService.getCompany(ticker);
  }

  @Get(':ticker/filings')
  async listFilings(
    @Param('ticker') ticker: string,
    @Query({ schema: filingsQuerySchema })
    query: { filters: FilingFilters; page: PageRequest },
    @Req() request: Request,
  ): Promise<Paginated<Filing>> {
    const page = await this.companiesService.listFilings(
      ticker,
      query.filters,
      query.page,
    );
    return toPaginated(page, request.originalUrl);
  }

  @Get(':ticker/filings/:accessionNumber')
  getFiling(
    @Param('ticker') ticker: string,
    @Param('accessionNumber', { schema: accessionNumberSchema })
    accessionNumber: string,
  ): Promise<Filing> {
    return this.companiesService.getFiling(ticker, accessionNumber);
  }
}
