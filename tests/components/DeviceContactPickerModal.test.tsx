import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as Contacts from 'expo-contacts';
import React from 'react';

import { DeviceContactPickerModal } from '@/components/features/emergency/DeviceContactPickerModal';

jest.setTimeout(15000);

const mockGetContactsAsync = jest.fn();

jest.mock('expo-contacts', () => ({
  requestPermissionsAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
}));

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
      <DeviceContactPickerModal
        visible
        existingPhones={new Set<string>()}
        onPick={onPick}
        onClose={jest.fn()}
      />,
    );

    const contact = await findByText('Ma');
    await fireEvent.press(contact);
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

    await render(
      <DeviceContactPickerModal
        visible
        existingPhones={new Set<string>()}
        onPick={jest.fn()}
        onClose={onClose}
      />,
    );

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mockGetContactsAsync).not.toHaveBeenCalled();
  });

  it('disables already added emergency contacts and ignores clicks on them', async () => {
    mockGetContactsAsync.mockResolvedValue({
      data: [{ id: '1', name: 'Ma', phoneNumbers: [{ number: '+919876543210' }] }],
    });
    const onPick = jest.fn();

    const { findByText } = await render(
      <DeviceContactPickerModal
        visible
        existingPhones={new Set<string>(['+919876543210'])}
        onPick={onPick}
        onClose={jest.fn()}
      />,
    );

    const contactName = await findByText('Ma');
    await fireEvent.press(contactName);
    expect(onPick).not.toHaveBeenCalled();
  });

  it('filters contacts by name case-insensitively', async () => {
    mockGetContactsAsync.mockResolvedValue({
      data: [
        { id: '1', name: 'Papa', phoneNumbers: [{ number: '9876543210' }] },
        { id: '2', name: 'Sister', phoneNumbers: [{ number: '9123456780' }] },
      ],
    });

    const { findByText, queryByText, findByPlaceholderText } = await render(
      <DeviceContactPickerModal
        visible
        existingPhones={new Set<string>()}
        onPick={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    expect(await findByText('Papa')).toBeTruthy();
    expect(await findByText('Sister')).toBeTruthy();

    const searchInput = await findByPlaceholderText('Search by name or number');
    await fireEvent.changeText(searchInput, 'pa');

    expect(await findByText('Papa')).toBeTruthy();
    expect(queryByText('Sister')).toBeNull();
  });

  it('filters contacts by partial and formatted phone numbers', async () => {
    mockGetContactsAsync.mockResolvedValue({
      data: [
        { id: '1', name: 'Papa', phoneNumbers: [{ number: '+91 98765 43210' }] },
        { id: '2', name: 'Sister', phoneNumbers: [{ number: '011-23456780' }] },
      ],
    });

    const { findByText, queryByText, findByPlaceholderText } = await render(
      <DeviceContactPickerModal
        visible
        existingPhones={new Set<string>()}
        onPick={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    const searchInput = await findByPlaceholderText('Search by name or number');
    await fireEvent.changeText(searchInput, '98765');

    expect(await findByText('Papa')).toBeTruthy();
    expect(queryByText('Sister')).toBeNull();

    // Partial digits search for Sister's number
    await fireEvent.changeText(searchInput, '23456');
    expect(await findByText('Sister')).toBeTruthy();
    expect(queryByText('Papa')).toBeNull();
  });

  it('shows empty state when no contacts match the search query', async () => {
    mockGetContactsAsync.mockResolvedValue({
      data: [{ id: '1', name: 'Papa', phoneNumbers: [{ number: '9876543210' }] }],
    });

    const { findByText, findByPlaceholderText, queryByText } = await render(
      <DeviceContactPickerModal
        visible
        existingPhones={new Set<string>()}
        onPick={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    const searchInput = await findByPlaceholderText('Search by name or number');
    await fireEvent.changeText(searchInput, 'Unknown Name');

    expect(await findByText('No matching contacts found')).toBeTruthy();
    expect(queryByText('Papa')).toBeNull();
  });

  it('clears search when clear button is pressed and restores full contact list', async () => {
    mockGetContactsAsync.mockResolvedValue({
      data: [
        { id: '1', name: 'Papa', phoneNumbers: [{ number: '9876543210' }] },
        { id: '2', name: 'Sister', phoneNumbers: [{ number: '9123456780' }] },
      ],
    });

    const { findByText, findByPlaceholderText, findByLabelText, queryByText } = await render(
      <DeviceContactPickerModal
        visible
        existingPhones={new Set<string>()}
        onPick={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    const searchInput = await findByPlaceholderText('Search by name or number');
    await fireEvent.changeText(searchInput, 'Papa');

    expect(await findByText('Papa')).toBeTruthy();
    expect(queryByText('Sister')).toBeNull();

    const clearButton = await findByLabelText('Close');
    await fireEvent.press(clearButton);

    expect(await findByText('Papa')).toBeTruthy();
    expect(await findByText('Sister')).toBeTruthy();
  });

  it('preserves duplicate disabled state when contacts are filtered via search', async () => {
    mockGetContactsAsync.mockResolvedValue({
      data: [
        { id: '1', name: 'Papa', phoneNumbers: [{ number: '+919876543210' }] },
        { id: '2', name: 'Sister', phoneNumbers: [{ number: '+919123456780' }] },
      ],
    });
    const onPick = jest.fn();

    const { findByText, findByPlaceholderText } = await render(
      <DeviceContactPickerModal
        visible
        existingPhones={new Set<string>(['+919876543210'])}
        onPick={onPick}
        onClose={jest.fn()}
      />,
    );

    const searchInput = await findByPlaceholderText('Search by name or number');
    await fireEvent.changeText(searchInput, 'Pa');

    const papaContact = await findByText('Papa');
    expect(await findByText('Already added')).toBeTruthy();

    await fireEvent.press(papaContact);
    expect(onPick).not.toHaveBeenCalled();
  });

  it('keeps the loaded list and search text when the parent re-renders with a new onClose', async () => {
    mockGetContactsAsync.mockResolvedValue({
      data: [
        { id: '1', name: 'Papa', phoneNumbers: [{ number: '9876543210' }] },
        { id: '2', name: 'Sister', phoneNumbers: [{ number: '9123456780' }] },
      ],
    });
    const existingPhones = new Set<string>();

    const { findByPlaceholderText, findByText, queryByText, rerender } = await render(
      <DeviceContactPickerModal
        visible
        existingPhones={existingPhones}
        onPick={jest.fn()}
        onClose={() => undefined}
      />,
    );

    const searchInput = await findByPlaceholderText('Search by name or number');
    await fireEvent.changeText(searchInput, 'Papa');

    await rerender(
      <DeviceContactPickerModal
        visible
        existingPhones={existingPhones}
        onPick={jest.fn()}
        onClose={() => undefined}
      />,
    );

    expect(await findByText('Papa')).toBeTruthy();
    expect(queryByText('Sister')).toBeNull();
    expect(mockGetContactsAsync).toHaveBeenCalledTimes(1);
  });
});
