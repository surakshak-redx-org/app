import { render } from '@testing-library/react-native';
import React from 'react';

import LanguageSelectScreen from '@app/language-select';

describe('LanguageSelectScreen', () => {
  it('renders without crashing', async () => {
    const { getByText } = await render(<LanguageSelectScreen />);
    expect(getByText('Select Language')).toBeTruthy();
  });

  it('shows the coming-soon placeholder', async () => {
    const { getByText } = await render(<LanguageSelectScreen />);
    expect(getByText('Coming Soon')).toBeTruthy();
  });
});
