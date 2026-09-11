import { act, fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { getMyIncidentReports, submitIncidentReport } from '@/services/firebase/incident.service';
import { useAuthStore } from '@/stores/auth.store';
import IncidentReportScreen from '@app/incident-report';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
  getCurrentPositionAsync: jest.fn(() =>
    Promise.resolve({
      coords: { latitude: 19.076, longitude: 72.8777, accuracy: 5 },
      timestamp: 1_700_000_000_000,
    }),
  ),
  Accuracy: { Balanced: 3 },
}));

jest.mock('@/services/firebase/incident.service', () => ({
  getMyIncidentReports: jest.fn(() => Promise.resolve([])),
  submitIncidentReport: jest.fn(() =>
    Promise.resolve({
      id: 'r1',
      userId: 'user-1',
      title: 'Followed',
      description: 'Followed near the station platform',
      latitude: 19.076,
      longitude: 72.8777,
      photoUrls: [],
      status: 'submitted',
      createdAt: { toDate: () => new Date() },
    }),
  ),
  uploadIncidentPhoto: jest.fn(),
}));

const authSnapshot = useAuthStore.getState();

describe('IncidentReportScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ ...authSnapshot, user: { uid: 'user-1' } as never });
  });

  it('renders without crashing', async () => {
    const { getByText } = await render(<IncidentReportScreen />);
    expect(getByText('Report an Incident')).toBeTruthy();
  });

  it('shows the form fields and the photo picker', async () => {
    const { getByText, getByPlaceholderText } = await render(<IncidentReportScreen />);
    expect(getByPlaceholderText('e.g. Harassment near Metro Station')).toBeTruthy();
    expect(
      getByPlaceholderText(
        'Describe the incident in detail. Include time, location details, and description of the person(s) involved.',
      ),
    ).toBeTruthy();
    expect(getByText('Submit Report')).toBeTruthy();
  });

  it('fills the form and submits a report once the location is available', async () => {
    const { getByPlaceholderText, getByText } = await render(<IncidentReportScreen />);

    // Let the mount-effect location fetch resolve.
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await fireEvent.changeText(
        getByPlaceholderText('e.g. Harassment near Metro Station'),
        'Followed',
      );
      await fireEvent.changeText(
        getByPlaceholderText(
          'Describe the incident in detail. Include time, location details, and description of the person(s) involved.',
        ),
        'Followed near the station platform',
      );
    });

    await act(async () => {
      await fireEvent.press(getByText('Submit Report'));
    });

    expect(submitIncidentReport).toHaveBeenCalledWith('user-1', {
      title: 'Followed',
      description: 'Followed near the station platform',
      latitude: 19.076,
      longitude: 72.8777,
      photoUrls: [],
    });
  });

  it('switches to the history tab and shows the empty state with no reports', async () => {
    const { getByText } = await render(<IncidentReportScreen />);

    await act(async () => {
      await fireEvent.press(getByText('History'));
    });

    expect(getMyIncidentReports).toHaveBeenCalledWith('user-1');
    expect(getByText('No reports yet')).toBeTruthy();
  });
});
