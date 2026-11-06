import { fireEvent, render } from '@testing-library/react-native';
import * as MediaLibrary from 'expo-media-library';
import React from 'react';
import { Share } from 'react-native';

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

  it('renders nothing when images array is empty', async () => {
    const { queryByLabelText } = await render(<ImageViewer images={[]} onClose={jest.fn()} />);
    expect(queryByLabelText('Close')).toBeNull();
  });

  it('paginates between multiple images with indicators and controls', async () => {
    const { getByLabelText, getByText } = await render(
      <ImageViewer
        images={['https://img/1', 'https://img/2']}
        initialIndex={0}
        onClose={jest.fn()}
      />,
    );

    expect(getByText('1 / 2')).toBeTruthy();
    expect(getByLabelText('Previous image').props.accessibilityState).toMatchObject({
      disabled: true,
    });

    await fireEvent.press(getByLabelText('Next image'));
    expect(getByText('2 / 2')).toBeTruthy();
    expect(getByLabelText('Next image').props.accessibilityState).toMatchObject({
      disabled: true,
    });

    await fireEvent.press(getByLabelText('Previous image'));
    expect(getByText('1 / 2')).toBeTruthy();
  });

  it('displays accessible photo labels with zoom instruction', async () => {
    const { getByLabelText } = await render(
      <ImageViewer images={['https://img/1', 'https://img/2']} onClose={jest.fn()} />,
    );

    expect(getByLabelText('Photo 1 of 2. Double tap to zoom.')).toBeTruthy();
  });

  it('saves image to gallery when save button is pressed', async () => {
    const { getByLabelText } = await render(
      <ImageViewer uri="file:///local/path/image.jpg" onClose={jest.fn()} />,
    );

    const saveButton = getByLabelText('Save Image');
    await fireEvent.press(saveButton);

    expect(MediaLibrary.requestPermissionsAsync).toHaveBeenCalled();
    expect(MediaLibrary.saveToLibraryAsync).toHaveBeenCalledWith('file:///local/path/image.jpg');
  });

  it('shares current image when share button is pressed', async () => {
    const shareSpy = jest
      .spyOn(Share, 'share')
      .mockImplementation(() => Promise.resolve({ action: Share.sharedAction }));

    const { getByLabelText } = await render(
      <ImageViewer uri="https://img/x" onClose={jest.fn()} />,
    );

    const shareButton = getByLabelText('Share');
    await fireEvent.press(shareButton);

    expect(shareSpy).toHaveBeenCalledWith({
      url: 'https://img/x',
      message: 'https://img/x',
    });
  });
});
