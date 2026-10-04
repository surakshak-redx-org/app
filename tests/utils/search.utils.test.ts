import { matchesSearch } from '@/utils/search.utils';

describe('matchesSearch', () => {
  const fields = ['Section 354D', 'Stalking online or offline', 'Digital Safety'];

  it('matches everything for an empty or blank query', () => {
    expect(matchesSearch('', fields)).toBe(true);
    expect(matchesSearch('   ', fields)).toBe(true);
  });

  it('finds a category name typed as the query', () => {
    expect(matchesSearch('Digital Safety', fields)).toBe(true);
    expect(matchesSearch('digital safety', fields)).toBe(true);
  });

  it('matches words spread across different fields', () => {
    expect(matchesSearch('stalking digital', fields)).toBe(true);
  });

  it('requires every word to match somewhere', () => {
    expect(matchesSearch('personal safety', fields)).toBe(false);
  });
});
