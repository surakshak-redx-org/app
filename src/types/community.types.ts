import type { Timestamp } from '@react-native-firebase/firestore';

export type PostType = 'text' | 'location' | 'image' | 'help_request';

/** Which slice of the community feed is on screen. */
export type CommunityTab = 'city' | 'all_india';

/** Mirrors Firestore `community/{postId}`. */
export interface CommunityPost {
  id: string;
  authorId: string;
  authorName: string;
  authorPhotoUrl: string;
  content: string;
  type: PostType;
  isAnonymous: boolean;
  locationUrl: string | null;
  imageUrl: string | null;
  city: string;
  state: string;
  reportCount: number;
  isHidden: boolean;
  createdAt: Timestamp;
}

export interface CreatePostInput {
  content: string;
  type: PostType;
  isAnonymous: boolean;
  locationUrl?: string;
  imageUrl?: string;
  city: string;
  state: string;
}
