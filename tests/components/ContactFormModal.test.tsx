import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import { ContactFormModal } from '@/components/features/emergency/ContactFormModal';

describe('ContactFormModal', () => {
  it('renders the add-contact fields when visible', async () => {
    const { getByText, getByLabelText } = await render(
      <ContactFormModal visible onSubmit={jest.fn()} onClose={jest.fn()} />,
    );
    expect(getByText('Add Contact')).toBeTruthy();
    expect(getByLabelText('Name')).toBeTruthy();
    expect(getByLabelText('Phone Number')).toBeTruthy();
    expect(getByLabelText('Relationship')).toBeTruthy();
  });

  it('prefills from an existing contact and shows the edit title', async () => {
    const { getByText, getByDisplayValue } = await render(
      <ContactFormModal
        visible
        initial={{
          id: 'c1',
          name: 'Ma',
          phone: '9876543210',
          relationship: 'Mother',
          isPredefined: false,
          order: 0,
        }}
        onSubmit={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    expect(getByText('Edit Contact')).toBeTruthy();
    await waitFor(() => {
      expect(getByDisplayValue('Ma')).toBeTruthy();
      expect(getByDisplayValue('Mother')).toBeTruthy();
    });
  });

  it('shows a validation error and blocks submit for an invalid phone', async () => {
    const onSubmit = jest.fn();
    const { getByLabelText, getByText, findByText } = await render(
      <ContactFormModal visible onSubmit={onSubmit} onClose={jest.fn()} />,
    );

    await fireEvent.changeText(getByLabelText('Name'), 'Ma');
    await fireEvent.changeText(getByLabelText('Phone Number'), '123');
    await fireEvent.changeText(getByLabelText('Relationship'), 'Mother');
    await fireEvent.press(getByText('Save'));

    expect(await findByText('Enter a valid 10-digit mobile number')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits trimmed values when the form is valid', async () => {
    const onSubmit = jest.fn();
    const { getByLabelText, getByText } = await render(
      <ContactFormModal visible onSubmit={onSubmit} onClose={jest.fn()} />,
    );

    await fireEvent.changeText(getByLabelText('Name'), '  Ma  ');
    await fireEvent.changeText(getByLabelText('Phone Number'), '9876543210');
    await fireEvent.changeText(getByLabelText('Relationship'), 'Mother');
    await fireEvent.press(getByText('Save'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        name: 'Ma',
        phone: '9876543210',
        relationship: 'Mother',
      });
    });
  });
});
