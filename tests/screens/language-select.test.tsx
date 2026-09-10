import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import { changeLanguage } from '@/i18n';
import { useAuthStore } from '@/stores/auth.store';
import LanguageSelectScreen from '@app/language-select';

const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: mockBack }),
}));

jest.mock('@/i18n', () => ({
  ...jest.requireActual('@/i18n'),
  changeLanguage: jest.fn(() => Promise.resolve()),
}));

describe('LanguageSelectScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.getState().reset();
  });

  it('lists all three languages', async () => {
    const { getByText } = await render(<LanguageSelectScreen />);

    expect(getByText('Select Language')).toBeTruthy();
    expect(getByText('English')).toBeTruthy();
    expect(getByText('हिन्दी')).toBeTruthy();
    expect(getByText('मराठी')).toBeTruthy();
  });

  it('switches language and navigates back', async () => {
    const { getByText } = await render(<LanguageSelectScreen />);

    await fireEvent.press(getByText('हिन्दी'));

    await waitFor(() => {
      expect(changeLanguage).toHaveBeenCalledWith('hi');
      expect(mockBack).toHaveBeenCalled();
    });
  });
});
