import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

import { ReplayBlock } from '@/components/ui/ReplayBlock';
import { SafeScreen } from '@/components/ui/SafeScreen';

describe('ReplayBlock', () => {
  it('still renders its children (blocking only affects what is recorded)', async () => {
    await render(
      <ReplayBlock>
        <Text>live location</Text>
      </ReplayBlock>,
    );

    expect(screen.getByText('live location')).toBeTruthy();
  });
});

describe('SafeScreen blockReplay', () => {
  it('renders children when replay is blocked', async () => {
    await render(
      <SafeScreen blockReplay>
        <Text>emergency contacts</Text>
      </SafeScreen>,
    );

    expect(screen.getByText('emergency contacts')).toBeTruthy();
  });

  it('renders children normally by default', async () => {
    await render(
      <SafeScreen>
        <Text>news</Text>
      </SafeScreen>,
    );

    expect(screen.getByText('news')).toBeTruthy();
  });
});
