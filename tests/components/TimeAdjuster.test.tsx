import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { TimeAdjuster } from '@/components/ui/TimeAdjuster';

describe('TimeAdjuster', () => {
  it('renders initial duration formatted and calculates clock time', async () => {
    const handleChange = jest.fn();
    const { getByTestId, getByText } = await render(
      <TimeAdjuster valueMinutes={45} onChange={handleChange} />,
    );

    expect(getByTestId('time-adjuster-value')).toBeTruthy();
    expect(getByText('45m')).toBeTruthy();
    expect(getByTestId('time-adjuster-clock')).toBeTruthy();
  });

  it('increments duration by step chip and triggers onChange', async () => {
    const handleChange = jest.fn();
    const { getByTestId } = await render(
      <TimeAdjuster valueMinutes={30} onChange={handleChange} />,
    );

    const plus15Chip = getByTestId('time-adjuster-chip-15');
    await fireEvent.press(plus15Chip);

    expect(handleChange).toHaveBeenCalledWith(45);
  });

  it('decrements duration by step chip and triggers onChange', async () => {
    const handleChange = jest.fn();
    const { getByTestId } = await render(
      <TimeAdjuster valueMinutes={30} onChange={handleChange} />,
    );

    const minus5Chip = getByTestId('time-adjuster-chip--5');
    await fireEvent.press(minus5Chip);

    expect(handleChange).toHaveBeenCalledWith(25);
  });

  it('clamps value to minMinutes and maxMinutes', async () => {
    const handleChange = jest.fn();
    const { getByTestId } = await render(
      <TimeAdjuster
        valueMinutes={10}
        minMinutes={5}
        maxMinutes={60}
        stepChips={[-15, 60]}
        onChange={handleChange}
      />,
    );

    const minus15Chip = getByTestId('time-adjuster-chip--15');
    await fireEvent.press(minus15Chip);
    expect(handleChange).toHaveBeenCalledWith(5);

    const plus60Chip = getByTestId('time-adjuster-chip-60');
    await fireEvent.press(plus60Chip);
    expect(handleChange).toHaveBeenCalledWith(60);
  });

  it('disables chips when value is already at boundary', async () => {
    const handleChange = jest.fn();
    const { getByTestId } = await render(
      <TimeAdjuster
        valueMinutes={5}
        minMinutes={5}
        maxMinutes={60}
        stepChips={[-15, -5, 5]}
        onChange={handleChange}
      />,
    );

    const minus5Chip = getByTestId('time-adjuster-chip--5');
    await fireEvent.press(minus5Chip);
    expect(handleChange).not.toHaveBeenCalled();
  });

  it('hides clock preview when showClockTime is false', async () => {
    const { queryByTestId } = await render(
      <TimeAdjuster valueMinutes={30} showClockTime={false} onChange={jest.fn()} />,
    );

    expect(queryByTestId('time-adjuster-clock')).toBeNull();
  });
});
