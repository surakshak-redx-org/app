import { render } from '@testing-library/react-native';
import React from 'react';

import TipsScreen from '@app/tips';

const mockGetSafetyTips = jest.fn();
const mockGetSafetyTipCategories = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

jest.mock('@/services/firebase/laws.service', () => ({
  getSafetyTips: (...args: unknown[]) => mockGetSafetyTips(...args),
  getSafetyTipCategories: (...args: unknown[]) => mockGetSafetyTipCategories(...args),
}));

const TIPS = [
  {
    id: 'tip_1',
    title: 'Note the cab number before you get in',
    content: 'Share it with a trusted contact.',
    category: 'Travel',
    order: 1,
    isPublished: true,
  },
  {
    id: 'tip_2',
    title: 'Keep building security on speed dial',
    content: 'Save the guard and society office numbers.',
    category: 'Home',
    order: 2,
    isPublished: true,
  },
];

describe('TipsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSafetyTips.mockResolvedValue(TIPS);
    mockGetSafetyTipCategories.mockResolvedValue(['Home', 'Travel']);
  });

  it('renders every tip and the category chips', async () => {
    const { getByText } = await render(<TipsScreen />);
    expect(getByText('Note the cab number before you get in')).toBeTruthy();
    expect(getByText('Keep building security on speed dial')).toBeTruthy();
    expect(getByText('All')).toBeTruthy();
    expect(getByText('Travel')).toBeTruthy();
    expect(getByText('Home')).toBeTruthy();
  });
});
