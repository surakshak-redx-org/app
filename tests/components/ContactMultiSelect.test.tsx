import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { ContactMultiSelect } from '@/components/features/location/ContactMultiSelect';
import type { EmergencyContact } from '@/types/user.types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

const contacts: EmergencyContact[] = [
  {
    id: 'c1',
    name: 'Asha',
    phone: '9000000001',
    relationship: 'Sister',
    isPredefined: false,
    order: 0,
  },
  {
    id: 'c2',
    name: 'Ravi',
    phone: '9000000002',
    relationship: 'Friend',
    isPredefined: false,
    order: 1,
  },
];

describe('ContactMultiSelect', () => {
  it('shows the empty state when there are no contacts', async () => {
    const { getByText } = await render(
      <ContactMultiSelect contacts={[]} selectedIds={[]} onToggle={jest.fn()} />,
    );
    expect(getByText('Add an emergency contact first')).toBeTruthy();
  });

  it('renders each contact and toggles selection on press', async () => {
    const onToggle = jest.fn();
    const { getByText } = await render(
      <ContactMultiSelect contacts={contacts} selectedIds={['c1']} onToggle={onToggle} />,
    );

    expect(getByText('Asha')).toBeTruthy();
    expect(getByText('Ravi')).toBeTruthy();

    await fireEvent.press(getByText('Ravi'));
    expect(onToggle).toHaveBeenCalledWith('c2');
  });
});
