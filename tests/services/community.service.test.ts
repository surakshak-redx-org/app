import {
  createPost,
  getCityPosts,
  reportPost,
  subscribeToCityPosts,
  uploadPostImage,
} from '@/services/firebase/community.service';

describe('community.service stubs', () => {
  it.each([
    ['getCityPosts', () => getCityPosts('Mumbai', 20)],
    [
      'createPost',
      () =>
        createPost('user-1', {
          content: 'hello',
          type: 'text',
          isAnonymous: false,
          city: 'Mumbai',
          state: 'MH',
        }),
    ],
    ['reportPost', () => reportPost('post-1', 'user-1')],
    ['uploadPostImage', () => uploadPostImage('user-1', 'file:///img.jpg')],
  ])('%s rejects until Phase 5 lands', async (_name, call) => {
    await expect(call()).rejects.toThrow('Not implemented');
  });

  it('subscribeToCityPosts throws synchronously — it returns an unsubscribe, not a promise', () => {
    expect(() => subscribeToCityPosts('Mumbai', jest.fn())).toThrow('Not implemented');
  });
});
