import { Injectable } from '@nestjs/common';

const CIK_LENGTH = 10;
const CIK_PATTERN = /^\d{1,10}$/;

@Injectable()
export class CikPaddingService {
  /** Zero-pads a CIK to the 10 digits EDGAR expects in its URLs. */
  pad(cik: number | string): string {
    const value = String(cik).trim();
    if (!CIK_PATTERN.test(value)) {
      throw new Error(`Invalid CIK: "${cik}"`);
    }
    return value.padStart(CIK_LENGTH, '0');
  }
}
