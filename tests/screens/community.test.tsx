import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { useAuthStore } from '@/stores/auth.store';
import type { CommunityPost } from '@/types/community.types';
import CommunityScreen from '@app/(tabs)/community';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

let feed: CommunityPost[] = [];
const mockCity = jest.fn((...args: unknown[]) => {
  (args[1] as (posts: CommunityPost[]) => void)(feed);
  return jest.fn();
});
const mockAll = jest.fn((...args: unknown[]) => {
  (args[0] as (posts: CommunityPost[]) => void)(feed);
  return jest.fn();
});
const mockCreate = jest.fn((..._args: unknown[]) => Promise.resolve('p1'));
const mockReport = jest.fn((..._args: unknown[]) => Promise.resolve());

jest.mock('@/services/firebase/community.service', () => ({
  subscribeToCityPosts: (...args: unknown[]) => mockCity(...args),
  subscribeToAllIndiaPosts: (...args: unknown[]) => mockAll(...args),
  createPost: (...args: unknown[]) => mockCreate(...args),
  reportPost: (...args: unknown[]) => mockReport(...args),
  uploadPostImage: jest.fn(() => Promise.resolve('https://cdn/x.jpg')),
  loadMoreCityPosts: jest.fn(() => Promise.resolve([])),
  loadMoreAllIndiaPosts: jest.fn(() => Promise.resolve([])),
}));

const authState = useAuthStore.getState();

const SEED_USER = {
  userId: 'u1',
  name: 'Asha',
  phone: '9000000000',
  profilePhotoUrl: '',
  city: 'Mumbai',
  state: 'MH',
  language: 'en' as const,
  isGuest: false,
  createdAt: null as never,
  updatedAt: null as never,
};

function makePost(id: string): CommunityPost {
  return {
    id,
    authorId: 'u2',
    authorName: 'Bina',
    authorPhotoUrl: '',
    content: `post ${id}`,
    type: 'text',
    isAnonymous: false,
    locationUrl: null,
    imageUrl: null,
    city: 'Mumbai',
    state: 'MH',
    reportCount: 0,
    isHidden: false,
    createdAt: { toDate: () => new Date() } as never,
  };
}

function seedAuthed(): void {
  useAuthStore.setState({ ...authState, surakshakUser: SEED_USER, isGuest: false });
}

describe('CommunityScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    feed = [];
    useAuthStore.setState(authState);
    seedAuthed();
  });

  it('renders the title and both feed tabs for an authed user', async () => {
    const { getByText } = await render(<CommunityScreen />);
    expect(getByText('Community')).toBeTruthy();
    expect(getByText('My City')).toBeTruthy();
    expect(getByText('All India')).toBeTruthy();
  });

  it('subscribes to the city feed and shows the compose FAB', async () => {
    const { getByLabelText } = await render(<CommunityScreen />);
    expect(mockCity).toHaveBeenCalled();
    expect(getByLabelText('New post')).toBeTruthy();
  });

  it('shows the empty state when the feed has no posts', async () => {
    const { getByText } = await render(<CommunityScreen />);
    expect(getByText('No posts yet')).toBeTruthy();
  });

  it('shows the guest banner and hides the FAB for a guest', async () => {
    useAuthStore.setState({ ...authState, surakshakUser: null, isGuest: true });

    const { getByText, queryByLabelText } = await render(<CommunityScreen />);

    expect(getByText('Sign in to post in the community')).toBeTruthy();
    expect(queryByLabelText('New post')).toBeNull();
    expect(mockCity).not.toHaveBeenCalled();
  });

  it('creates a post from the compose sheet', async () => {
    const { getByLabelText, getByText, getByPlaceholderText } = await render(<CommunityScreen />);

    await fireEvent.press(getByLabelText('New post'));
    await fireEvent.changeText(getByPlaceholderText('Type a message...'), 'Hello city');
    await fireEvent.press(getByText('Post'));

    expect(mockCreate).toHaveBeenCalled();
  });

  it('confirms before reporting a post', async () => {
    const { Alert } = jest.requireActual<typeof import('react-native')>('react-native');
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    feed = [makePost('p1')];

    const { getByLabelText } = await render(<CommunityScreen />);
    await fireEvent.press(getByLabelText('Report Post'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Report this post?',
      expect.any(String),
      expect.any(Array),
    );
    alertSpy.mockRestore();
  });

  it('switches to the All-India feed', async () => {
    const { getByText } = await render(<CommunityScreen />);
    await fireEvent.press(getByText('All India'));
    expect(mockAll).toHaveBeenCalled();
  });
});
