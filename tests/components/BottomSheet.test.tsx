import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

import { BottomSheet } from '@/components/ui/BottomSheet';

describe('BottomSheet', () => {
  it('renders its children when visible', async () => {
    const { getByText } = await render(
      <BottomSheet visible onClose={jest.fn()}>
        <Text>Sheet content</Text>
      </BottomSheet>,
    );
    expect(getByText('Sheet content')).toBeTruthy();
  });

  it('closes when the backdrop is pressed', async () => {
    const onClose = jest.fn();
    const { getByLabelText } = await render(
      <BottomSheet visible onClose={onClose}>
        <Text>Sheet content</Text>
      </BottomSheet>,
    );

    await fireEvent.press(getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not render its children when hidden', async () => {
    const { queryByText } = await render(
      <BottomSheet visible={false} onClose={jest.fn()}>
        <Text>Sheet content</Text>
      </BottomSheet>,
    );
    expect(queryByText('Sheet content')).toBeNull();
  });
});
