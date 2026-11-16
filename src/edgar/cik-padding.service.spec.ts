import { CikPaddingService } from './cik-padding.service.js';

describe('CikPaddingService', () => {
  const service = new CikPaddingService();

  it.each([
    [320193, '0000320193'],
    ['320193', '0000320193'],
    [1, '0000000001'],
    ['0000320193', '0000320193'],
    [1234567890, '1234567890'],
  ])('pads %s to %s', (input, expected) => {
    expect(service.pad(input)).toBe(expected);
  });

  it.each(['', 'abc', '12a', '-1', '1.5', '12345678901', 1.5, -1])(
    'rejects %s',
    (input) => {
      expect(() => service.pad(input)).toThrow('Invalid CIK');
    },
  );
});
