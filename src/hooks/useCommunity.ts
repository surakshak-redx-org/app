import { useCallback, useState } from 'react';

import type { CommunityPost, CreatePostInput } from '@/types/community.types';

export interface UseCommunityResult {
  posts: CommunityPost[];
  isLoading: boolean;
  createPost: (input: CreatePostInput) => Promise<void>;
  reportPost: (postId: string) => Promise<void>;
}

/** TODO: Phase 5 — Community. Will attach a Firestore realtime listener. */
export function useCommunity(): UseCommunityResult {
  const [posts] = useState<CommunityPost[]>([]);
  const [isLoading] = useState(false);

  const createPost = useCallback((): Promise<void> => {
    return Promise.reject(new Error('Not implemented — Phase 5'));
  }, []);

  const reportPost = useCallback((): Promise<void> => {
    return Promise.reject(new Error('Not implemented — Phase 5'));
  }, []);

  return { posts, isLoading, createPost, reportPost };
}
