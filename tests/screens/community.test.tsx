import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { STORAGE_FLAG_ON, STORAGE_KEYS } from '@/constants/storage';
import { useAuthStore } from '@/stores/auth.store';
import type { CommunityPost } from '@/types/community.types';
import CommunityScreen from '@app/(tabs)/community';

// The first cold render of this screen (FlatList + vector-icon glyph maps +
// NativeWind JIT) can exceed Jest's 5s default on a loaded CI runner.
jest.setTimeout(20000);

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}));

const mockPlaceCall = jest.fn((_phone: string) => Promise.resolve());
jest.mock('@/utils/phone.utils', () => {
  const actual = jest.requireActual<typeof import('@/utils/phone.utils')>('@/utils/phone.utils');
  return {
    ...actual,
    placeCall: (phone: string) => mockPlaceCall(phone),
  };
});

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
  deletePost: jest.fn(() => Promise.resolve()),
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

function makePost(
  id: string,
  type: CommunityPost['type'] = 'text',
  createdAt = { toDate: () => new Date() } as never,
): CommunityPost {
  return {
    id,
    authorId: 'u2',
    authorName: 'Bina',
    authorPhotoUrl: '',
    content: `post ${id}`,
    type,
    isAnonymous: false,
    locationUrl: null,
    imageUrl: null,
    city: 'Mumbai',
    state: 'MH',
    reportCount: 0,
    isHidden: false,
    createdAt,
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

  it('configures FlatList with virtualization props to prevent memory ballooning', async () => {
    feed = [makePost('p1'), makePost('p2')];
    const { getByTestId } = await render(<CommunityScreen />);
    const flatList = getByTestId('community-feed-list');

    expect(flatList.props.windowSize).toBe(5);
    expect(flatList.props.removeClippedSubviews).toBe(true);
    expect(flatList.props.maxToRenderPerBatch).toBe(5);
    expect(flatList.props.initialNumToRender).toBe(6);
  });

  it('renders emergency disclaimer banner with SOS and Call 112 actions', async () => {
    const { getByText, getByLabelText } = await render(<CommunityScreen />);

    expect(
      getByText('In immediate danger? Do not post here. Tap SOS or call 112 immediately.'),
    ).toBeTruthy();

    await fireEvent.press(getByLabelText('SOS'));
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/');

    await fireEvent.press(getByLabelText('Call 112'));
    expect(mockPlaceCall).toHaveBeenCalledWith('112');
  });

  it('filters posts by Safety Alerts and excludes incidents older than 72 hours', async () => {
    const freshIncidentTime = { toMillis: () => Date.now() - 3600 * 1000 } as never;
    const oldIncidentTime = { toMillis: () => Date.now() - 80 * 3600 * 1000 } as never;

    feed = [
      makePost('p-fresh', 'incident', freshIncidentTime),
      makePost('p-old', 'incident', oldIncidentTime),
      makePost('p-help', 'help_request'),
      makePost('p-text', 'text'),
    ];

    const { getByText, queryByText } = await render(<CommunityScreen />);

    // Switch to Safety Alerts
    await fireEvent.press(getByText('🚨 Safety Alerts'));

    expect(getByText('post p-fresh')).toBeTruthy();
    expect(queryByText('post p-old')).toBeNull();
    expect(queryByText('post p-help')).toBeNull();
    expect(queryByText('post p-text')).toBeNull();
  });

  it('filters posts by Help Requests and Discussions', async () => {
    feed = [
      makePost('p-fresh', 'incident'),
      makePost('p-help', 'help_request'),
      makePost('p-text', 'text'),
    ];

    const { getByText, queryByText } = await render(<CommunityScreen />);

    // Filter by Help Requests
    await fireEvent.press(getByText('🆘 Help Requests'));
    expect(getByText('post p-help')).toBeTruthy();
    expect(queryByText('post p-fresh')).toBeNull();
    expect(queryByText('post p-text')).toBeNull();

    // Filter by Discussions
    await fireEvent.press(getByText('💬 Discussions'));
    expect(getByText('post p-text')).toBeTruthy();
    expect(queryByText('post p-fresh')).toBeNull();
    expect(queryByText('post p-help')).toBeNull();

    // Switch back to All
    await fireEvent.press(getByText('All'));
    expect(getByText('post p-fresh')).toBeTruthy();
    expect(getByText('post p-help')).toBeTruthy();
    expect(getByText('post p-text')).toBeTruthy();
  });

  it('shows empty filter state when no posts match filter category', async () => {
    feed = [makePost('p-text', 'text')];

    const { getByText, queryByText } = await render(<CommunityScreen />);

    await fireEvent.press(getByText('🚨 Safety Alerts'));
    expect(queryByText('post p-text')).toBeNull();
    expect(getByText('No posts found for this filter')).toBeTruthy();
  });

  it('allows dismissing the emergency disclaimer banner and persists state', async () => {
    const { getByLabelText, queryByText } = await render(<CommunityScreen />);

    expect(queryByText(/In immediate danger\?/)).toBeTruthy();
    const dismissBtn = getByLabelText('Dismiss emergency notice');
    await fireEvent.press(dismissBtn);

    expect(queryByText(/In immediate danger\?/)).toBeNull();
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      STORAGE_KEYS.COMMUNITY_DISCLAIMER_DISMISSED,
      STORAGE_FLAG_ON,
    );
  });
});
