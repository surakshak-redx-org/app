import { act, fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { useAuthStore } from '@/stores/auth.store';
import SilentRecordingScreen from '@app/silent-recording';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

const mockRecord = jest.fn();
const mockStop = jest.fn(() => Promise.resolve());

jest.mock('expo-audio', () => ({
  RecordingPresets: { HIGH_QUALITY: {} },
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
  useAudioRecorder: jest.fn(() => ({ record: mockRecord, stop: mockStop, uri: 'file:///rec.m4a' })),
  useAudioRecorderState: jest.fn(() => ({ isRecording: false, durationMillis: 5_000 })),
  requestRecordingPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(() => Promise.resolve(true)),
}));

jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn(() => Promise.resolve()),
  deactivateKeepAwake: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/services/firebase/incident.service', () => ({
  uploadEvidenceRecording: jest.fn(() => Promise.resolve('https://storage/evidence.m4a')),
}));

jest.mock('@/services/sms.service', () => ({
  sendEvidenceLinkAlert: jest.fn(() => Promise.resolve({ sent: [], failed: [] })),
}));

const authSnapshot = useAuthStore.getState();

describe('SilentRecordingScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ ...authSnapshot, user: { uid: 'user-1' } as never });
  });

  it('renders without crashing', async () => {
    const { getByText } = await render(<SilentRecordingScreen />);
    expect(getByText('Silent Recording')).toBeTruthy();
  });

  it('shows the start-recording button and the max-duration notice', async () => {
    const { getByText } = await render(<SilentRecordingScreen />);
    expect(getByText('Start Recording')).toBeTruthy();
    expect(getByText(/Max duration: 30 minutes/)).toBeTruthy();
  });

  it('starts recording, then stops and uploads, reaching the success screen', async () => {
    const { getByText } = await render(<SilentRecordingScreen />);

    await act(async () => {
      await fireEvent.press(getByText('Start Recording'));
    });
    expect(mockRecord).toHaveBeenCalled();

    await act(async () => {
      await fireEvent.press(getByText('Stop & Upload'));
    });

    expect(mockStop).toHaveBeenCalled();
    expect(getByText('Evidence Saved')).toBeTruthy();
  });

  it('copies the link to the clipboard from the success screen', async () => {
    const Clipboard: { setStringAsync: jest.Mock } = jest.requireMock('expo-clipboard');
    const { getByText } = await render(<SilentRecordingScreen />);

    await act(async () => {
      await fireEvent.press(getByText('Start Recording'));
    });
    await act(async () => {
      await fireEvent.press(getByText('Stop & Upload'));
    });
    await act(async () => {
      await fireEvent.press(getByText('Copy Link'));
    });

    expect(Clipboard.setStringAsync).toHaveBeenCalledWith('https://storage/evidence.m4a');
  });
});
