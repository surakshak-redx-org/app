import { render } from '@testing-library/react-native';
import React from 'react';

import LawDetailScreen from '@app/law/[id]';

const mockGetLawById = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'law_1' }),
}));

jest.mock('@/services/firebase/laws.service', () => ({
  getLawById: (...args: unknown[]) => mockGetLawById(...args),
}));

const LAW = {
  id: 'law_1',
  title: 'Protection of Women from Domestic Violence Act, 2005',
  shortDescription: 'Protects women at home.',
  fullContent: 'The Act provides effective protection of the rights of women.',
  category: 'Domestic Safety',
  tags: ['domestic violence', 'protection order'],
  order: 1,
  isPublished: true,
};

describe('LawDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetLawById.mockResolvedValue(LAW);
  });

  it('renders the law title, full content, and the helpline card', async () => {
    const { getByText } = await render(<LawDetailScreen />);
    expect(getByText(LAW.title)).toBeTruthy();
    expect(getByText(LAW.fullContent)).toBeTruthy();
    expect(getByText('Need legal help?')).toBeTruthy();
  });

  it('shows an error state when the law cannot be loaded', async () => {
    mockGetLawById.mockResolvedValue(null);
    const { getByText } = await render(<LawDetailScreen />);
    expect(getByText("Couldn't load content. Pull to refresh or try later.")).toBeTruthy();
  });
});
