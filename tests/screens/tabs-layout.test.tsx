import { render } from '@testing-library/react-native';
import React from 'react';

import { useAuthStore } from '@/stores/auth.store';
import TabsLayout from '@app/(tabs)/_layout';

const registeredScreens: Record<string, { href?: unknown }> = {};

jest.mock('expo-router', () => {
  const actualReact = jest.requireActual('react');
  function Tabs({ children }: { children: React.ReactNode }): React.JSX.Element {
    return actualReact.createElement(actualReact.Fragment, null, children);
  }
  function TabsScreen({ name, options }: { name: string; options: { href?: unknown } }): null {
    registeredScreens[name] = options;
    return null;
  }
  Tabs.Screen = TabsScreen;
  return { Tabs };
});

describe('TabsLayout', () => {
  beforeEach(() => {
    useAuthStore.getState().reset();
    for (const key of Object.keys(registeredScreens)) delete registeredScreens[key];
  });

  it('shows the map tab for a signed-in user', async () => {
    await render(<TabsLayout />);
    expect(registeredScreens.map?.href).toBeUndefined();
  });

  it('hides the map tab for a guest, since reading unsafeAreas requires auth', async () => {
    useAuthStore.getState().setGuest(true);
    await render(<TabsLayout />);
    expect(registeredScreens.map?.href).toBeNull();
  });
});
