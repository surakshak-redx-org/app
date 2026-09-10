import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { IncomingCallOverlay } from '@/components/features/emergency/IncomingCallOverlay';

jest.mock('expo-audio', () => ({
  createAudioPlayer: () => ({
    play: jest.fn(),
    pause: jest.fn(),
    remove: jest.fn(),
    loop: false,
    volume: 0,
  }),
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
}));

describe('IncomingCallOverlay', () => {
  it('shows the caller and the incoming-call label', async () => {
    const { getByText } = await render(
      <IncomingCallOverlay visible callerName="Mom" onAnswer={jest.fn()} onDecline={jest.fn()} />,
    );
    expect(getByText('Mom')).toBeTruthy();
    expect(getByText('Incoming Call')).toBeTruthy();
  });

  it('declines the call', async () => {
    const onDecline = jest.fn();
    const { getByLabelText } = await render(
      <IncomingCallOverlay visible callerName="Mom" onAnswer={jest.fn()} onDecline={onDecline} />,
    );

    await fireEvent.press(getByLabelText('Decline'));
    expect(onDecline).toHaveBeenCalledTimes(1);
  });

  it('answers and then ends the call', async () => {
    const onAnswer = jest.fn();
    const onDecline = jest.fn();
    const { getByLabelText, getByText } = await render(
      <IncomingCallOverlay visible callerName="Mom" onAnswer={onAnswer} onDecline={onDecline} />,
    );

    await fireEvent.press(getByLabelText('Answer'));
    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(getByText('Ongoing call')).toBeTruthy();

    await fireEvent.press(getByLabelText('End Call'));
    expect(onDecline).toHaveBeenCalledTimes(1);
  });
});
