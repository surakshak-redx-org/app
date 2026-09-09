import en from '@/i18n/locales/en.json';
import hi from '@/i18n/locales/hi.json';
import mr from '@/i18n/locales/mr.json';

type Catalogue = { [key: string]: string | Catalogue };

function flatten(source: Catalogue, prefix = ''): string[] {
  return Object.entries(source).flatMap(([key, value]) => {
    const path = prefix === '' ? key : `${prefix}.${key}`;
    return typeof value === 'string' ? [path] : flatten(value, path);
  });
}

const enKeys = flatten(en).sort();

describe('translation catalogues', () => {
  it.each([
    ['hi', hi],
    ['mr', mr],
  ])('%s has exactly the same key set as en', (_language, catalogue) => {
    expect(flatten(catalogue as Catalogue).sort()).toEqual(enKeys);
  });

  it('every English string is non-empty', () => {
    const blanks = Object.entries(en as Catalogue).filter(([, value]) => value === '');
    expect(blanks).toHaveLength(0);
  });
});
