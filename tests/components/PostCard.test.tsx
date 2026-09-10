import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { Linking } from 'react-native';

import { PostCard } from '@/components/features/community/PostCard';
import type { CommunityPost } from '@/types/community.types';

function makePost(overrides: Partial<CommunityPost> = {}): CommunityPost {
  return {
    id: 'p1',
    authorId: 'u2',
    authorName: 'Asha',
    authorPhotoUrl: '',
    content: 'Stay safe near the station tonight.',
    type: 'text',
    isAnonymous: false,
    locationUrl: null,
    imageUrl: null,
    city: 'Mumbai',
    state: 'MH',
    reportCount: 0,
    isHidden: false,
    createdAt: { toDate: () => new Date() } as never,
    ...overrides,
  };
}

describe('PostCard', () => {
  it('shows the author name for a named post', async () => {
    const { getByText } = await render(
      <PostCard post={makePost()} isGuest={false} onReport={jest.fn()} onOpenImage={jest.fn()} />,
    );
    expect(getByText('Asha')).toBeTruthy();
  });

  it('shows "Anonymous" and hides the real name for an anonymous post', async () => {
    const { getByText, queryByText } = await render(
      <PostCard
        post={makePost({ isAnonymous: true, authorName: '' })}
        isGuest={false}
        onReport={jest.fn()}
        onOpenImage={jest.fn()}
      />,
    );
    expect(getByText('Anonymous')).toBeTruthy();
    expect(queryByText('Asha')).toBeNull();
  });

  it('renders the "Help Needed" badge for a help request', async () => {
    const { getByText } = await render(
      <PostCard
        post={makePost({ type: 'help_request' })}
        isGuest={false}
        onReport={jest.fn()}
        onOpenImage={jest.fn()}
      />,
    );
    expect(getByText('Help Needed')).toBeTruthy();
  });

  it('opens the maps link when "View on Maps" is pressed', async () => {
    const spy = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const { getByText } = await render(
      <PostCard
        post={makePost({ type: 'location', locationUrl: 'https://maps/x' })}
        isGuest={false}
        onReport={jest.fn()}
        onOpenImage={jest.fn()}
      />,
    );

    await fireEvent.press(getByText('View on Maps'));

    expect(spy).toHaveBeenCalledWith('https://maps/x');
    spy.mockRestore();
  });

  it('calls onOpenImage with the url when the thumbnail is pressed', async () => {
    const onOpenImage = jest.fn();
    const { getByLabelText } = await render(
      <PostCard
        post={makePost({ type: 'image', imageUrl: 'https://img/x' })}
        isGuest={false}
        onReport={jest.fn()}
        onOpenImage={onOpenImage}
      />,
    );

    await fireEvent.press(getByLabelText('View image'));

    expect(onOpenImage).toHaveBeenCalledWith('https://img/x');
  });

  it('reports the post id for an authed user', async () => {
    const onReport = jest.fn();
    const { getByLabelText } = await render(
      <PostCard post={makePost()} isGuest={false} onReport={onReport} onOpenImage={jest.fn()} />,
    );

    await fireEvent.press(getByLabelText('Report Post'));

    expect(onReport).toHaveBeenCalledWith('p1');
  });

  it('hides the report control for a guest', async () => {
    const { queryByLabelText } = await render(
      <PostCard post={makePost()} isGuest onReport={jest.fn()} onOpenImage={jest.fn()} />,
    );
    expect(queryByLabelText('Report Post')).toBeNull();
  });
});
