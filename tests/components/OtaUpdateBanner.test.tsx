import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as Updates from 'expo-updates';
import React from 'react';
import { Alert } from 'react-native';

import { OtaUpdateBanner } from '@/components/features/settings/OtaUpdateBanner';
import { useLocationStore } from '@/stores/location.store';
import { useSOSStore } from '@/stores/sos.store';

describe('OtaUpdateBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Updates as { isEnabled: boolean }).isEnabled = true;
    useLocationStore.getState().setSafeJourneyActive(false);
    useSOSStore.getState().reset();
  });

  it('renders nothing when no update is available', async () => {
    jest.mocked(Updates.checkForUpdateAsync).mockResolvedValueOnce({
      isAvailable: false,
    } as never);

    const { queryByText } = await render(<OtaUpdateBanner />);

    await waitFor(() => {
      expect(Updates.checkForUpdateAsync).toHaveBeenCalled();
    });
    expect(queryByText('An update is available')).toBeNull();
  });

  it('shows the banner once an update is found', async () => {
    jest.mocked(Updates.checkForUpdateAsync).mockResolvedValueOnce({
      isAvailable: true,
      manifest: { id: 'update-1' },
    } as never);

    const { findByText } = await render(<OtaUpdateBanner />);

    expect(await findByText('An update is available')).toBeTruthy();
    expect(await findByText('Restart & Update')).toBeTruthy();
  });

  it('blocks update and warns user if Safe Journey is active (BUG-137)', async () => {
    useLocationStore.getState().setSafeJourneyActive(true, 'j1');
    jest.mocked(Updates.checkForUpdateAsync).mockResolvedValueOnce({
      isAvailable: true,
      manifest: { id: 'update-1' },
    } as never);
    const alertSpy = jest.spyOn(Alert, 'alert');

    const { findByText } = await render(<OtaUpdateBanner />);
    const button = await findByText('Restart & Update');
    await fireEvent.press(button);

    expect(alertSpy).toHaveBeenCalledWith(
      'Safety Session in Progress',
      expect.stringContaining(
        'Cannot restart to apply updates while Safe Journey or SOS is active',
      ),
    );
  });
});
