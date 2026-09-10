import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as Contacts from 'expo-contacts';
import React from 'react';

import { DeviceContactPickerModal } from '@/components/features/emergency/DeviceContactPickerModal';

const mockGetContactsAsync = jest.fn();

jest.mock('expo-contacts/legacy', () => ({
  Fields: { PhoneNumbers: 'phoneNumbers' },
  getContactsAsync: (...args: unknown[]) => mockGetContactsAsync(...args),
}));

describe('DeviceContactPickerModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .mocked(Contacts.requestPermissionsAsync)
      .mockResolvedValue({ granted: true, status: 'granted' } as never);
  });

  it('lists device contacts and calls onPick with the first number', async () => {
    mockGetContactsAsync.mockResolvedValue({
      data: [
        { id: '1', name: 'Ma', phoneNumbers: [{ number: '98765 43210' }] },
        { id: '2', name: 'No Number', phoneNumbers: [] },
      ],
    });
    const onPick = jest.fn();

    const { findByText } = await render(
      <DeviceContactPickerModal visible onPick={onPick} onClose={jest.fn()} />,
    );

    await fireEvent.press(await findByText('Ma'));
    expect(onPick).toHaveBeenCalledWith({
      name: 'Ma',
      phone: '98765 43210',
      relationship: '',
    });
  });

  it('closes with a permission alert when contacts access is denied', async () => {
    jest
      .mocked(Contacts.requestPermissionsAsync)
      .mockResolvedValue({ granted: false, status: 'denied' } as never);
    const onClose = jest.fn();

    await render(<DeviceContactPickerModal visible onPick={jest.fn()} onClose={onClose} />);

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mockGetContactsAsync).not.toHaveBeenCalled();
  });
});
