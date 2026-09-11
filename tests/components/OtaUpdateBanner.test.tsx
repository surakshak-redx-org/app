import { render, waitFor } from '@testing-library/react-native';
import * as Updates from 'expo-updates';
import React from 'react';

import { OtaUpdateBanner } from '@/components/features/settings/OtaUpdateBanner';

describe('OtaUpdateBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Updates as { isEnabled: boolean }).isEnabled = true;
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
});
