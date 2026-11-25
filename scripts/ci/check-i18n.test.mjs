import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compare, LOCALES, placeholders } from './check-i18n.mjs';

describe('placeholders', () => {
  it('lists top-level arguments with their type, ignoring text inside plural branches', () => {
    expect(placeholders('From {time} ({minutes, plural, one {# minute} other {# minutes}})')).toBe('minutes:plural,time');
  });
});

describe('compare', () => {
  it('reports missing, extra and mismatched keys', () => {
    const problems = compare({ en: { a: 'x {t}', b: 'y' }, hi: { a: 'x' }, ur: { a: 'x {t}', b: 'y', c: 'z' } });
    expect(problems).toEqual(['hi: a has placeholders {}, English has {t}', 'hi: missing b', 'ur: c is not in en.json']);
  });

  it('passes on the committed message files', () => {
    const catalogs = Object.fromEntries(LOCALES.map((l) => [l, JSON.parse(fs.readFileSync(`messages/${l}.json`, 'utf8'))]));
    expect(compare(catalogs)).toEqual([]);
  });
});
