import { addDoc, getDoc, getDocs, updateDoc } from '@react-native-firebase/firestore';

import {
  createLiveLocationSession,
  extendLiveLocationSession,
  getActiveLiveSession,
  stopLiveLocationSession,
  updateLiveLocation,
} from '@/services/firebase/live-location.service';

jest.mock('@react-native-firebase/firestore', () => {
  const fromDate = (date: Date): { toDate: () => Date } => ({ toDate: () => date });
  return {
    getFirestore: jest.fn(() => ({})),
    collection: jest.fn((...segments: string[]) => ({ path: segments.join('/') })),
    doc: jest.fn((...segments: string[]) => ({ path: segments.join('/') })),
    addDoc: jest.fn(() => Promise.resolve({ id: 'session-1' })),
    getDoc: jest.fn(),
    getDocs: jest.fn(() => Promise.resolve({ docs: [] })),
    updateDoc: jest.fn(() => Promise.resolve()),
    query: jest.fn((ref: unknown) => ref),
    where: jest.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
    limit: jest.fn((n: number) => ({ limit: n })),
    orderBy: jest.fn((field: string) => ({ orderBy: field })),
    onSnapshot: jest.fn(() => jest.fn()),
    serverTimestamp: jest.fn(() => ({ __serverTimestamp: true })),
    increment: jest.fn((n: number) => ({ __increment: n })),
    arrayUnion: jest.fn((value: unknown) => ({ __arrayUnion: value })),
    Timestamp: { fromDate },
  };
});

const mockSnap = (data: unknown): unknown => ({
  exists: () => data !== undefined,
  id: 'session-1',
  data: () => data,
});

describe('live-location.service', () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => errorSpy.mockRestore());

  it('createLiveLocationSession writes isActive:true and a location URL', async () => {
    const id = await createLiveLocationSession('user-1', ['user-2'], 2, 19.076, 72.8777);

    expect(id).toBe('session-1');
    const payload = jest.mocked(addDoc).mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload).toMatchObject({
      userId: 'user-1',
      sharedWithUserIds: ['user-2'],
      isActive: true,
      locationUrl: 'https://www.google.com/maps/place/19.076,72.8777',
    });
  });

  it('updateLiveLocation updates latitude, longitude and locationUrl', async () => {
    await updateLiveLocation('session-1', 1, 2);
    expect(updateDoc).toHaveBeenCalledWith(expect.anything(), {
      latitude: 1,
      longitude: 2,
      locationUrl: 'https://www.google.com/maps/place/1,2',
    });
  });

  it('stopLiveLocationSession sets isActive:false', async () => {
    await stopLiveLocationSession('session-1');
    expect(updateDoc).toHaveBeenCalledWith(expect.anything(), { isActive: false });
  });

  it('extendLiveLocationSession never pushes expiry past the max window', async () => {
    const startedAt = new Date('2026-01-01T00:00:00Z');
    jest.mocked(getDoc).mockResolvedValueOnce(
      mockSnap({
        startedAt: { toDate: () => startedAt },
        expiresAt: { toDate: () => new Date('2026-01-01T07:30:00Z') },
      }) as never,
    );

    await extendLiveLocationSession('session-1', 4);

    const payload = jest.mocked(updateDoc).mock.calls[0]?.[1] as unknown as {
      expiresAt: { toDate: () => Date };
    };
    // 7.5h + 4h would be 11.5h, but the cap is 8h from startedAt.
    expect(payload.expiresAt.toDate().toISOString()).toBe('2026-01-01T08:00:00.000Z');
  });

  it('getActiveLiveSession returns null when there is no active session', async () => {
    jest.mocked(getDocs).mockResolvedValueOnce({ docs: [] } as never);
    await expect(getActiveLiveSession('user-1')).resolves.toBeNull();
  });

  it('getActiveLiveSession maps the first matching document', async () => {
    jest.mocked(getDocs).mockResolvedValueOnce({
      docs: [{ id: 'session-9', data: () => ({ userId: 'user-1', isActive: true }) }],
    } as never);

    const session = await getActiveLiveSession('user-1');
    expect(session).toMatchObject({ id: 'session-9', userId: 'user-1', isActive: true });
  });

  it('extendLiveLocationSession rejects when the session is gone', async () => {
    jest.mocked(getDoc).mockResolvedValueOnce(mockSnap(undefined) as never);
    await expect(extendLiveLocationSession('missing', 1)).rejects.toThrow('Session not found');
    expect(errorSpy).toHaveBeenCalled();
  });

  it.each([
    [
      'createLiveLocationSession',
      (): Promise<unknown> => createLiveLocationSession('u', [], 1, 0, 0),
    ],
    ['updateLiveLocation', (): Promise<unknown> => updateLiveLocation('s', 0, 0)],
    ['stopLiveLocationSession', (): Promise<unknown> => stopLiveLocationSession('s')],
    ['getActiveLiveSession', (): Promise<unknown> => getActiveLiveSession('u')],
  ])('%s logs and rethrows when Firestore fails', async (_name, call) => {
    jest.mocked(addDoc).mockRejectedValueOnce(new Error('offline'));
    jest.mocked(updateDoc).mockRejectedValueOnce(new Error('offline'));
    jest.mocked(getDocs).mockRejectedValueOnce(new Error('offline'));
    await expect(call()).rejects.toThrow('offline');
    expect(errorSpy).toHaveBeenCalled();
  });
});
