import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { SOSCountdownOverlay } from '@/components/features/sos/SOSCountdownOverlay';

describe('SOSCountdownOverlay', () => {
  it('shows the current count and the localized countdown line', async () => {
    const { getByText } = await render(<SOSCountdownOverlay countdown={3} onCancel={jest.fn()} />);
    expect(getByText('3')).toBeTruthy();
    expect(getByText('Sending SOS in 3s...')).toBeTruthy();
  });

  it('calls onCancel when the cancel control is pressed', async () => {
    const onCancel = jest.fn();
    const { getByLabelText } = await render(
      <SOSCountdownOverlay countdown={5} onCancel={onCancel} />,
    );

    await fireEvent.press(getByLabelText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('shows a non-cancellable sending state once the countdown has elapsed', async () => {
    const { getByText, queryByLabelText, queryByText } = await render(
      <SOSCountdownOverlay countdown={0} isSending onCancel={jest.fn()} />,
    );

    expect(getByText('Sending SOS alert to your contacts…')).toBeTruthy();
    expect(queryByText('0')).toBeNull();
    expect(queryByLabelText('Cancel')).toBeNull();
  });

  it('announces descending seconds to screen readers on each tick', async () => {
    const { AccessibilityInfo } = jest.requireActual<typeof import('react-native')>('react-native');
    const announceSpy = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => undefined);

    const { rerender } = await render(<SOSCountdownOverlay countdown={3} onCancel={jest.fn()} />);
    expect(announceSpy).toHaveBeenCalledWith('Sending SOS in 3s...');

    await rerender(<SOSCountdownOverlay countdown={2} onCancel={jest.fn()} />);
    expect(announceSpy).toHaveBeenCalledWith('Sending SOS in 2s...');

    announceSpy.mockRestore();
  });
});
