import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import type { EvidenceRecordingRecord } from '@/services/evidence.service';
import MyRecordingsScreen from '@app/my-recordings';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(() => Promise.resolve(true)),
}));

const mockGetEvidenceRecordings = jest.fn<Promise<EvidenceRecordingRecord[]>, []>();

jest.mock('@/services/evidence.service', () => ({
  getEvidenceRecordings: () => mockGetEvidenceRecordings(),
  clearEvidenceRecordingHistory: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/services/sms.service', () => ({
  sendEvidenceLinkAlert: jest.fn(() => Promise.resolve({ sent: [], failed: [] })),
}));

describe('MyRecordingsScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the empty state when there is no history', async () => {
    mockGetEvidenceRecordings.mockResolvedValue([]);
    const { getByText } = await render(<MyRecordingsScreen />);

    await waitFor(() => {
      expect(getByText('No recordings yet')).toBeTruthy();
    });
  });

  it('renders a record with its formatted duration and offers open/copy/share', async () => {
    mockGetEvidenceRecordings.mockResolvedValue([
      {
        id: 'r1',
        url: 'https://storage/evidence.m4a',
        durationSeconds: 95,
        createdAt: Date.now(),
      },
    ]);

    const { getByText } = await render(<MyRecordingsScreen />);

    await waitFor(() => {
      expect(getByText('1:35')).toBeTruthy();
    });
    expect(getByText('Open')).toBeTruthy();
    expect(getByText('Copy Link')).toBeTruthy();
    expect(getByText('Share with Emergency Contacts')).toBeTruthy();
  });

  it('copies the recording link to the clipboard', async () => {
    const Clipboard: { setStringAsync: jest.Mock } = jest.requireMock('expo-clipboard');
    mockGetEvidenceRecordings.mockResolvedValue([
      { id: 'r1', url: 'https://storage/evidence.m4a', durationSeconds: 10, createdAt: Date.now() },
    ]);

    const { getByText } = await render(<MyRecordingsScreen />);
    await waitFor(() => expect(getByText('Copy Link')).toBeTruthy());
    await fireEvent.press(getByText('Copy Link'));

    expect(Clipboard.setStringAsync).toHaveBeenCalledWith('https://storage/evidence.m4a');
  });
});
