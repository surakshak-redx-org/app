import { fireEvent, render } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import React from 'react';

import { SOSButton } from '@/components/features/sos/SOSButton';

describe('SOSButton', () => {
  beforeEach(() => {
    jest.mocked(Haptics.notificationAsync).mockClear();
  });

  it('exposes the accessibility label and hint screen readers need', async () => {
    const { getByLabelText } = await render(<SOSButton onTrigger={jest.fn()} />);
    expect(getByLabelText('SOS Emergency Button')).toBeTruthy();
  });

  it('fires the trigger and a warning haptic on press', async () => {
    const onTrigger = jest.fn();
    const { getByLabelText } = await render(<SOSButton onTrigger={onTrigger} />);

    await fireEvent.press(getByLabelText('SOS Emergency Button'));

    expect(onTrigger).toHaveBeenCalledTimes(1);
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Warning,
    );
  });

  it('does not fire when disabled', async () => {
    const onTrigger = jest.fn();
    const { getByLabelText } = await render(<SOSButton onTrigger={onTrigger} disabled />);

    await fireEvent.press(getByLabelText('SOS Emergency Button'));
    expect(onTrigger).not.toHaveBeenCalled();
  });
});
