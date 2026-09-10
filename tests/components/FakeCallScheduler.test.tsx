import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { FakeCallScheduler } from '@/components/features/emergency/FakeCallScheduler';

describe('FakeCallScheduler', () => {
  it('renders the delay presets when visible', async () => {
    const { getByText } = await render(
      <FakeCallScheduler visible onSchedule={jest.fn()} onClose={jest.fn()} />,
    );
    expect(getByText('Now')).toBeTruthy();
    expect(getByText('1 min')).toBeTruthy();
    expect(getByText('5 min')).toBeTruthy();
    expect(getByText('Custom')).toBeTruthy();
  });

  it('schedules with the chosen delay and the default caller name', async () => {
    const onSchedule = jest.fn();
    const { getByText } = await render(
      <FakeCallScheduler visible onSchedule={onSchedule} onClose={jest.fn()} />,
    );

    await fireEvent.press(getByText('1 min'));
    await fireEvent.press(getByText('Schedule Call'));

    expect(onSchedule).toHaveBeenCalledWith(60, 'Mom');
  });
});
