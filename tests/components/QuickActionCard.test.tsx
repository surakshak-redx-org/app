import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { QuickActionCard } from '@/components/features/emergency/QuickActionCard';

describe('QuickActionCard', () => {
  it('renders the translated label and fires onPress', async () => {
    const onPress = jest.fn();
    const { getByText } = await render(
      <QuickActionCard icon="call" labelKey="home.fakeCall" onPress={onPress} />,
    );

    await fireEvent.press(getByText('Fake Call'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('shows the badge when provided', async () => {
    const { getByText } = await render(
      <QuickActionCard
        icon="people"
        labelKey="home.emergencyContacts"
        onPress={jest.fn()}
        badge="3"
      />,
    );
    expect(getByText('3')).toBeTruthy();
  });

  it('omits the badge when not provided', async () => {
    const { queryByText } = await render(
      <QuickActionCard icon="people" labelKey="home.emergencyContacts" onPress={jest.fn()} />,
    );
    expect(queryByText('3')).toBeNull();
  });

  it('marks a locked card disabled but still fires onPress, letting the caller decide what happens', async () => {
    const onPress = jest.fn();
    const { getByRole } = await render(
      <QuickActionCard icon="people" labelKey="home.emergencyContacts" onPress={onPress} locked />,
    );

    const card = getByRole('button');
    expect(card.props.accessibilityState).toMatchObject({ disabled: true });

    await fireEvent.press(card);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
