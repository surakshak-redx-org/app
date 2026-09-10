import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import InfoScreen from '@app/(tabs)/info';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}));

jest.mock('@/utils/cache.utils', () => ({
  CACHE_KEYS: { LAWS: 'laws', FAQS: 'faqs', TIPS: 'tips', NEWS: 'news' },
  getCacheTimestamp: jest.fn(() => Promise.resolve(null)),
}));

describe('InfoScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the four section cards', async () => {
    const { getByText } = await render(<InfoScreen />);
    expect(getByText('Laws for Women')).toBeTruthy();
    expect(getByText('FAQ')).toBeTruthy();
    expect(getByText('Safety Tips')).toBeTruthy();
    expect(getByText('News')).toBeTruthy();
  });

  it('navigates to a section when its card is pressed', async () => {
    const { getByLabelText } = await render(<InfoScreen />);
    await fireEvent.press(getByLabelText('Safety Tips'));
    expect(mockPush).toHaveBeenCalledWith('/tips');
  });
});
