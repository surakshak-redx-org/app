import { render } from '@testing-library/react-native';
import React from 'react';

import { ROUTES } from '@/constants/routes';
import { useDisguiseStore } from '@/stores/disguise.store';
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
  beforeEach(() => {
    mockRedirect.mockClear();
    useDisguiseStore.setState({ isEnabled: false, isUnlockedThisSession: false });
  });

  it('goes straight to the calculator when Disguise Mode is on', async () => {
    useDisguiseStore.setState({ isEnabled: true });
    await render(<IndexScreen />);
    expect(mockRedirect).toHaveBeenCalledWith(ROUTES.CALCULATOR);
  });

  it('goes to Home once the PIN has been entered this session', async () => {
    useDisguiseStore.setState({ isEnabled: true, isUnlockedThisSession: true });
    await render(<IndexScreen />);
    expect(mockRedirect).toHaveBeenCalledWith(ROUTES.HOME);
  });

  it('redirects to the home tab', async () => {
    await render(<IndexScreen />);
    expect(mockRedirect).toHaveBeenCalledWith(ROUTES.HOME);
  });
});
