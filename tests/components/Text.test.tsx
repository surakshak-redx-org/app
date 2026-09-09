import { render } from '@testing-library/react-native';
import React from 'react';

import { Text } from '@/components/ui/Text';

describe('Text', () => {
  it('renders children when no translation key is given', async () => {
    const { getByText } = await render(<Text variant="body">Plain copy</Text>);
    expect(getByText('Plain copy')).toBeTruthy();
  });

  it('resolves a translation key', async () => {
    const { getByText } = await render(<Text variant="h1" tKey="home.tagline" />);
    expect(getByText('Har Kadam, Surakshit')).toBeTruthy();
  });

  it('interpolates translation options', async () => {
    const { getByText } = await render(
      <Text variant="body" tKey="emergency.sosAlertSent" tOptions={{ count: 3 }} />,
    );
    expect(getByText('SOS alert sent to 3 contacts')).toBeTruthy();
  });

  it('prefers the translation key over children', async () => {
    const { getByText, queryByText } = await render(
      <Text variant="body" tKey="common.retry">
        ignored
      </Text>,
    );
    expect(getByText('Try again')).toBeTruthy();
    expect(queryByText('ignored')).toBeNull();
  });

  it.each(['h1', 'h2', 'h3', 'body', 'caption', 'label'] as const)(
    'renders the %s variant',
    async (variant) => {
      const { getByText } = await render(<Text variant={variant}>Copy</Text>);
      expect(getByText('Copy')).toBeTruthy();
    },
  );
});
