import { Controller, Get, Param, Query } from '@nestjs/common';
import { CompaniesService } from './companies.service.js';
import {
  accessionNumberSchema,
  filingsQuerySchema,
} from './companies.schemas.js';
import type { Company } from './company.js';
import type { Filing, FilingFilters } from './filing.js';

@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get(':ticker')
  getCompany(@Param('ticker') ticker: string): Promise<Company> {
    return this.companiesService.getCompany(ticker);
  }

  @Get(':ticker/filings')
  listFilings(
    @Param('ticker') ticker: string,
    @Query({ schema: filingsQuerySchema }) filters: FilingFilters,
  ): Promise<Filing[]> {
    return this.companiesService.listFilings(ticker, filters);
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
