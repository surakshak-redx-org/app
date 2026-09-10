import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { ImageViewer } from '@/components/features/community/ImageViewer';

describe('ImageViewer', () => {
  it('renders nothing when the uri is null', async () => {
    const { queryByLabelText } = await render(<ImageViewer uri={null} onClose={jest.fn()} />);
    expect(queryByLabelText('Close')).toBeNull();
  });

  it('closes when the backdrop is pressed', async () => {
    const onClose = jest.fn();
    const { getByLabelText } = await render(<ImageViewer uri="https://img/x" onClose={onClose} />);

    await fireEvent.press(getByLabelText('Close'));

    expect(onClose).toHaveBeenCalled();
  });
});
