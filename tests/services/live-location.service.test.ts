import { addDoc, getDoc, getDocs, updateDoc, writeBatch } from '@react-native-firebase/firestore';

import {
  createLiveLocationSession,
  extendLiveLocationSession,
  getActiveLiveSession,
  markLiveLocationArrived,
  revokeShareToken,
  stopLiveLocationSession,
  updateLiveLocation,
} from '@/services/firebase/live-location.service';

const mockBatch = {
  update: jest.fn(),
  set: jest.fn(),
  commit: jest.fn(() => Promise.resolve()),
};

jest.mock('@react-native-firebase/firestore', () => {
  const fromDate = (date: Date): { toDate: () => Date } => ({ toDate: () => date });
  return {
    writeBatch: jest.fn(() => mockBatch),
    deleteField: jest.fn(() => ({ __deleteField: true })),
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

  it('createLiveLocationSession stores the share token and active status', async () => {
    await createLiveLocationSession('user-1', [], 1, 0, 0, 'dev-1', 'token-abc');

    const payload = jest.mocked(addDoc).mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload).toMatchObject({ shareToken: 'token-abc', status: 'active', deviceId: 'dev-1' });
  });

  it('createLiveLocationSession stores only the destination fields it needs', async () => {
    const destination = {
      name: 'Home',
      latitude: 19.1,
      longitude: 72.9,
      extra: 'dropped',
    };
    await createLiveLocationSession('user-1', [], 1, 0, 0, 'dev-1', 'token-abc', destination);

    const payload = jest.mocked(addDoc).mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload.destination).toEqual({ name: 'Home', latitude: 19.1, longitude: 72.9 });
  });

  it('createLiveLocationSession omits the destination when none is given', async () => {
    await createLiveLocationSession('user-1', [], 1, 0, 0);

    const payload = jest.mocked(addDoc).mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload).not.toHaveProperty('destination');
  });

  it('markLiveLocationArrived ends the session with status arrived', async () => {
    await markLiveLocationArrived('session-1');
    expect(updateDoc).toHaveBeenCalledWith(expect.anything(), {
      isActive: false,
      status: 'arrived',
    });
  });

  it('updateLiveLocation batches the session update without reading first', async () => {
    await updateLiveLocation('session-1', 1, 2, false);

    expect(getDoc).not.toHaveBeenCalled();
    expect(writeBatch).toHaveBeenCalledTimes(1);
    expect(mockBatch.update).toHaveBeenCalledWith(expect.anything(), {
      latitude: 1,
      longitude: 2,
      locationUrl: 'https://www.google.com/maps/place/1,2',
      lastFixAt: { __serverTimestamp: true },
      status: 'active',
    });
    expect(mockBatch.set).not.toHaveBeenCalled();
    expect(mockBatch.commit).toHaveBeenCalledTimes(1);
  });

  it('updateLiveLocation stores telemetry and drops undefined readings defensively', async () => {
    // The type forbids `undefined`, but Firestore throws on it, so the service
    // strips it anyway in case a caller casts around the type.
    await updateLiveLocation('session-1', 1, 2, false, {
      batteryLevel: 0.4,
      isCharging: false,
      speed: 3,
      trackingProfile: 'walking',
      heading: undefined,
    } as never);

    expect(mockBatch.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        batteryLevel: 0.4,
        isCharging: false,
        speed: 3,
        trackingProfile: 'walking',
        status: 'active',
      }),
    );
    const payload = mockBatch.update.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload).not.toHaveProperty('heading');
  });

  it('updateLiveLocation also records a trail point when appendPoint is set', async () => {
    await updateLiveLocation('session-1', 1, 2, true);

    expect(mockBatch.set).toHaveBeenCalledWith(expect.anything(), {
      latitude: 1,
      longitude: 2,
      recordedAt: { __serverTimestamp: true },
    });
    expect(mockBatch.commit).toHaveBeenCalledTimes(1);
  });

  it('stopLiveLocationSession sets isActive:false and status ended', async () => {
    await stopLiveLocationSession('session-1');
    expect(updateDoc).toHaveBeenCalledWith(expect.anything(), {
      isActive: false,
      status: 'ended',
    });
  });

  it('revokeShareToken deletes the token field', async () => {
    await revokeShareToken('session-1');
    expect(updateDoc).toHaveBeenCalledWith(expect.anything(), {
      shareToken: { __deleteField: true },
    });
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
    [
      'updateLiveLocation',
      (): Promise<unknown> => {
        mockBatch.commit.mockRejectedValueOnce(new Error('offline'));
        return updateLiveLocation('s', 0, 0, false);
      },
    ],
    ['revokeShareToken', (): Promise<unknown> => revokeShareToken('s')],
    ['markLiveLocationArrived', (): Promise<unknown> => markLiveLocationArrived('s')],
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
