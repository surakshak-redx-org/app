import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import * as ReactNative from 'react-native';

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

  it('shows the subtitle and the warning when provided', async () => {
    const { getByText } = await render(
      <QuickActionCard
        icon="people"
        labelKey="home.emergencyContacts"
        onPress={jest.fn()}
        subtitle="3 contacts"
        warning="Add"
      />,
    );
    expect(getByText('3 contacts')).toBeTruthy();
    expect(getByText('Add')).toBeTruthy();
  });

  it('omits the subtitle and the warning when not provided', async () => {
    const { queryByText } = await render(
      <QuickActionCard icon="people" labelKey="home.emergencyContacts" onPress={jest.fn()} />,
    );
    expect(queryByText('3 contacts')).toBeNull();
    expect(queryByText('Add')).toBeNull();
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

  it('renders standard 2-column layout when fontScale is normal', async () => {
    const dimSpy = jest.spyOn(ReactNative.Dimensions, 'get').mockReturnValue({
      fontScale: 1.0,
      width: 400,
      height: 800,
      scale: 1,
    });

    const { getByRole } = await render(
      <QuickActionCard icon="people" labelKey="home.emergencyContacts" onPress={jest.fn()} />,
    );
    const card = getByRole('button');
    expect(card.props.className).toContain('w-1/2');

    dimSpy.mockRestore();
  });

  it('adapts to full-width row layout when system font scale is at 200%', async () => {
    const spy = jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({
      fontScale: 2.0,
      width: 400,
      height: 800,
      scale: 2,
    });

    const { getByRole } = await render(
      <QuickActionCard
        icon="people"
        labelKey="home.emergencyContacts"
        warning="Add"
        onPress={jest.fn()}
      />,
    );
    const card = getByRole('button');
    expect(card.props.className).toContain('w-full');
    expect(card.props.className).not.toContain('w-1/2');

    spy.mockRestore();
  });
});
