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

  it('sanitizes non-numeric characters from pasted phone numbers', async () => {
    const onSubmit = jest.fn();
    const { getByLabelText, getByText, getByDisplayValue } = await render(
      <ContactFormModal visible onSubmit={onSubmit} onClose={jest.fn()} />,
    );

    await fireEvent.changeText(getByLabelText('Name'), 'Ma');
    await fireEvent.changeText(getByLabelText('Phone Number'), '9876543210abc🔥');
    await fireEvent.changeText(getByLabelText('Relationship'), 'Mother');

    expect(getByDisplayValue('9876543210')).toBeTruthy();

    await fireEvent.press(getByText('Save'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        name: 'Ma',
        phone: '+919876543210',
        relationship: 'Mother',
      });
    });
  });

  it('normalizes leading-zero phone numbers to E.164 on submit (BUG-144)', async () => {
    const onSubmit = jest.fn();
    const { getByLabelText, getByText } = await render(
      <ContactFormModal visible onSubmit={onSubmit} onClose={jest.fn()} />,
    );

    await fireEvent.changeText(getByLabelText('Name'), 'Papa');
    await fireEvent.changeText(getByLabelText('Phone Number'), '09876543210');
    await fireEvent.changeText(getByLabelText('Relationship'), 'Father');

    await fireEvent.press(getByText('Save'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        name: 'Papa',
        phone: '+919876543210',
        relationship: 'Father',
      });
    });
  });

  it('preserves active typed input when component re-renders (BUG-140)', async () => {
    const { getByLabelText, getByDisplayValue, rerender } = await render(
      <ContactFormModal visible onSubmit={jest.fn()} onClose={jest.fn()} />,
    );

    await fireEvent.changeText(getByLabelText('Name'), 'Ananya');
    await fireEvent.changeText(getByLabelText('Phone Number'), '9876543210');

    expect(getByDisplayValue('Ananya')).toBeTruthy();
    expect(getByDisplayValue('9876543210')).toBeTruthy();

    // Re-render while visible (e.g. language or theme change)
    await rerender(<ContactFormModal visible onSubmit={jest.fn()} onClose={jest.fn()} />);

    // Value must not be wiped by reset()
    expect(getByDisplayValue('Ananya')).toBeTruthy();
    expect(getByDisplayValue('9876543210')).toBeTruthy();
  });

  it('blocks submit and shows error for repeated dummy phone numbers', async () => {
    const onSubmit = jest.fn();
    const { getByLabelText, getByText, findByText } = await render(
      <ContactFormModal visible onSubmit={onSubmit} onClose={jest.fn()} />,
    );

    await fireEvent.changeText(getByLabelText('Name'), 'Ma');
    await fireEvent.changeText(getByLabelText('Phone Number'), '9999999999');
    await fireEvent.changeText(getByLabelText('Relationship'), 'Mother');
    await fireEvent.press(getByText('Save'));

    expect(await findByText('Enter a valid 10-digit mobile number')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
