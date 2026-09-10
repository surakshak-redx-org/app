import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import LawsScreen from '@app/laws';

const mockGetLaws = jest.fn();
const mockGetLawCategories = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

jest.mock('@/services/firebase/laws.service', () => ({
  getLaws: (...args: unknown[]) => mockGetLaws(...args),
  getLawCategories: (...args: unknown[]) => mockGetLawCategories(...args),
}));

const LAWS = [
  {
    id: 'law_1',
    title: 'Domestic Violence Act',
    shortDescription: 'Protects women at home.',
    fullContent: 'Full text.',
    category: 'Domestic Safety',
    tags: ['abuse'],
    order: 1,
    isPublished: true,
  },
  {
    id: 'law_2',
    title: 'Workplace Harassment Act',
    shortDescription: 'Internal Complaints Committee.',
    fullContent: 'Full text.',
    category: 'Workplace Safety',
    tags: ['workplace'],
    order: 2,
    isPublished: true,
  },
];

describe('LawsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetLaws.mockResolvedValue(LAWS);
    mockGetLawCategories.mockResolvedValue(['Domestic Safety', 'Workplace Safety']);
  });

  it('renders the search field, an All chip, and the law list', async () => {
    const { getByPlaceholderText, getByText } = await render(<LawsScreen />);
    expect(getByPlaceholderText('Search')).toBeTruthy();
    expect(getByText('All')).toBeTruthy();
    expect(getByText('Domestic Violence Act')).toBeTruthy();
    expect(getByText('Workplace Harassment Act')).toBeTruthy();
  });

  it('filters the list by search query', async () => {
    const { getByPlaceholderText, getByText, queryByText } = await render(<LawsScreen />);
    await fireEvent.changeText(getByPlaceholderText('Search'), 'workplace');
    expect(getByText('Workplace Harassment Act')).toBeTruthy();
    expect(queryByText('Domestic Violence Act')).toBeNull();
  });
});
