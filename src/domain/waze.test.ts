import { describe, expect, test } from 'vitest';
import { wazeUrl } from './waze';

describe('wazeUrl', () => {
  test('builds a navigate deep link with an encoded query', () => {
    expect(wazeUrl('Timna Park')).toBe('https://waze.com/ul?q=Timna%20Park&navigate=yes');
  });

  test('encodes Hebrew place names', () => {
    const url = wazeUrl('פארק תמנע');
    expect(url).toContain('q=%D7%A4%D7%90%D7%A8%D7%A7%20%D7%AA%D7%9E%D7%A0%D7%A2');
    expect(url).toContain('&navigate=yes');
  });

  test('encodes URL-hostile characters and trims whitespace', () => {
    expect(wazeUrl('  A&B ')).toBe('https://waze.com/ul?q=A%26B&navigate=yes');
  });
});
