import { render } from '@testing-library/react-native';
import React from 'react';

import NotFoundScreen from '@app/+not-found';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn() },
  Stack: { Screen: (): null => null },
}));

describe('NotFoundScreen', () => {
  it('renders the not-found title', async () => {
    const { getByText } = await render(<NotFoundScreen />);
    expect(getByText('Page Not Found')).toBeTruthy();
  });

  it('offers a way back to the home screen', async () => {
    const { getByText } = await render(<NotFoundScreen />);
    expect(getByText('Go to Home')).toBeTruthy();
  });
});
