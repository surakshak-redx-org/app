import type { CommunityPost, CreatePostInput } from '@/types/community.types';

/**
 * Subscribes to the live post feed for a city.
 * @phase Phase 5 — Community
 */
export function subscribeToCityPosts(
  _city: string,
  _onChange: (posts: CommunityPost[]) => void,
): () => void {
  throw new Error('Not implemented — Phase 5');
}

/**
 * Fetches a page of posts for a city.
 * @phase Phase 5 — Community
 */
export function getCityPosts(_city: string, _limit: number): Promise<CommunityPost[]> {
  return Promise.reject(new Error('Not implemented — Phase 5'));
}

/**
 * Publishes a new community post.
 * @phase Phase 5 — Community
 */
export function createPost(_userId: string, _input: CreatePostInput): Promise<CommunityPost> {
  return Promise.reject(new Error('Not implemented — Phase 5'));
}

/**
 * Increments a post's report count; the post auto-hides past the threshold.
 * @phase Phase 5 — Community
 */
export function reportPost(_postId: string, _userId: string): Promise<void> {
  return Promise.reject(new Error('Not implemented — Phase 5'));
}

/**
 * Uploads a community image and returns its download URL.
 * @phase Phase 5 — Community
 */
export function uploadPostImage(_userId: string, _localUri: string): Promise<string> {
  return Promise.reject(new Error('Not implemented — Phase 5'));
}
