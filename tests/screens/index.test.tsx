import { render } from '@testing-library/react-native';
import React from 'react';

import { ROUTES } from '@/constants/routes';
import IndexScreen from '@app/index';

// Must be `mock`-prefixed: jest hoists `jest.mock` above imports and rejects
// out-of-scope references to anything else.
const mockRedirect = jest.fn();

jest.mock('expo-router', () => ({
  Redirect: (props: { href: string }): null => {
    mockRedirect(props.href);
    return null;
  },
}));

describe('IndexScreen', () => {
  it('redirects to the home tab', async () => {
    await render(<IndexScreen />);
    expect(mockRedirect).toHaveBeenCalledWith(ROUTES.HOME);
  });
});
