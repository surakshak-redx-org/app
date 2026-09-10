import { addDoc, getDoc, getDocs, updateDoc } from '@react-native-firebase/firestore';

import {
  cancelSafeJourney,
  checkInSafeJourney,
  createSafeJourneySession,
  getActiveJourneySession,
  markAlertSent,
  markSafeJourneyArrived,
} from '@/services/firebase/safe-journey.service';

jest.mock('@react-native-firebase/firestore', () => {
  const fromDate = (date: Date): { toDate: () => Date } => ({ toDate: () => date });
  return {
    getFirestore: jest.fn(() => ({})),
    collection: jest.fn((...segments: string[]) => ({ path: segments.join('/') })),
    doc: jest.fn((...segments: string[]) => ({ path: segments.join('/') })),
    addDoc: jest.fn(() => Promise.resolve({ id: 'journey-1' })),
    getDoc: jest.fn(),
    getDocs: jest.fn(() => Promise.resolve({ docs: [] })),
    updateDoc: jest.fn(() => Promise.resolve()),
    query: jest.fn((ref: unknown) => ref),
    where: jest.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
    limit: jest.fn((n: number) => ({ limit: n })),
    serverTimestamp: jest.fn(() => ({ __serverTimestamp: true })),
    Timestamp: { fromDate },
  };
});

describe('safe-journey.service', () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => errorSpy.mockRestore());

  it('createSafeJourneySession starts active with a future expected-arrival', async () => {
    const before = Date.now();
    const id = await createSafeJourneySession('user-1', 'Office', 19.1, 72.9, 30, ['user-2']);

    expect(id).toBe('journey-1');
    const payload = jest.mocked(addDoc).mock.calls[0]?.[1] as {
      status: string;
      expectedArrivalAt: { toDate: () => Date };
      destinationName: string;
    };
    expect(payload.status).toBe('active');
    expect(payload.destinationName).toBe('Office');
    expect(payload.expectedArrivalAt.toDate().getTime()).toBeGreaterThanOrEqual(
      before + 30 * 60 * 1000,
    );
  });

  it('markSafeJourneyArrived sets status:arrived', async () => {
    await markSafeJourneyArrived('journey-1');
    expect(updateDoc).toHaveBeenCalledWith(expect.anything(), { status: 'arrived' });
  });

  it('cancelSafeJourney sets status:cancelled', async () => {
    await cancelSafeJourney('journey-1');
    expect(updateDoc).toHaveBeenCalledWith(expect.anything(), { status: 'cancelled' });
  });

  it('markAlertSent sets status:alert_sent', async () => {
    await markAlertSent('journey-1');
    expect(updateDoc).toHaveBeenCalledWith(expect.anything(), { status: 'alert_sent' });
  });

  it('checkInSafeJourney pushes the arrival time out by another ETA interval', async () => {
    jest.mocked(getDoc).mockResolvedValueOnce({
      exists: () => true,
      id: 'journey-1',
      data: () => ({ etaMinutes: 20 }),
    } as never);

    const before = Date.now();
    await checkInSafeJourney('journey-1');

    const payload = jest.mocked(updateDoc).mock.calls[0]?.[1] as unknown as {
      expectedArrivalAt: { toDate: () => Date };
    };
    expect(payload.expectedArrivalAt.toDate().getTime()).toBeGreaterThanOrEqual(
      before + 20 * 60 * 1000,
    );
  });

  it('getActiveJourneySession returns null when none is active', async () => {
    jest.mocked(getDocs).mockResolvedValueOnce({ docs: [] } as never);
    await expect(getActiveJourneySession('user-1')).resolves.toBeNull();
  });

  it('getActiveJourneySession maps the first active document', async () => {
    jest.mocked(getDocs).mockResolvedValueOnce({
      docs: [{ id: 'journey-9', data: () => ({ status: 'active', destinationName: 'Home' }) }],
    } as never);
    await expect(getActiveJourneySession('user-1')).resolves.toMatchObject({
      id: 'journey-9',
      destinationName: 'Home',
    });
  });

  it('checkInSafeJourney rejects when the session is missing', async () => {
    jest
      .mocked(getDoc)
      .mockResolvedValueOnce({ exists: () => false, id: 'x', data: () => undefined } as never);
    await expect(checkInSafeJourney('missing')).rejects.toThrow('Session not found');
    expect(errorSpy).toHaveBeenCalled();
  });

  it.each([
    [
      'createSafeJourneySession',
      (): Promise<unknown> => createSafeJourneySession('u', 'D', 0, 0, 30, []),
    ],
    ['markSafeJourneyArrived', (): Promise<unknown> => markSafeJourneyArrived('s')],
    ['cancelSafeJourney', (): Promise<unknown> => cancelSafeJourney('s')],
    ['markAlertSent', (): Promise<unknown> => markAlertSent('s')],
  ])('%s logs and rethrows when Firestore fails', async (_name, call) => {
    jest.mocked(addDoc).mockRejectedValueOnce(new Error('offline'));
    jest.mocked(updateDoc).mockRejectedValueOnce(new Error('offline'));
    await expect(call()).rejects.toThrow('offline');
    expect(errorSpy).toHaveBeenCalled();
  });
});
