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

  it.each([
    ['hi', hi],
    ['mr', mr],
  ])('%s has no missing or empty translations', (_language, catalogue) => {
    const blanks = flatten(catalogue as Catalogue).filter(
      (key) => getNestedValue(catalogue as Catalogue, key) === '',
    );
    expect(blanks).toEqual([]);
  });
});

function getNestedValue(catalogue: Catalogue, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, segment) => {
    if (acc !== null && typeof acc === 'object') {
      return (acc as Catalogue)[segment];
    }
    return undefined;
  }, catalogue);
}
