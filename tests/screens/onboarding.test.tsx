import { render } from '@testing-library/react-native';
import React from 'react';

import OnboardingScreen from '@app/(auth)/onboarding';

describe('OnboardingScreen', () => {
  it('renders without crashing', async () => {
    const { getByText } = await render(<OnboardingScreen />);
    expect(getByText('Get Started')).toBeTruthy();
  });

  it('shows the coming-soon placeholder', async () => {
    const { getByText } = await render(<OnboardingScreen />);
    expect(getByText('Coming Soon')).toBeTruthy();
  });
});
