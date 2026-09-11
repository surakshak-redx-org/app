import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  clearEvidenceRecordingHistory,
  getEvidenceRecordings,
  recordEvidenceUpload,
} from '@/services/evidence.service';

describe('evidence recording history', () => {
  beforeEach(() => jest.clearAllMocks());

  it('round-trips a record through AsyncStorage, newest first', async () => {
    const store = new Map<string, string>();
    jest
      .mocked(AsyncStorage.getItem)
      .mockImplementation((key: string) => Promise.resolve(store.get(key) ?? null));
    jest.mocked(AsyncStorage.setItem).mockImplementation((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    });

    const first = await recordEvidenceUpload({ url: 'https://storage/a.m4a', durationSeconds: 30 });
    const second = await recordEvidenceUpload({
      url: 'https://storage/b.m4a',
      durationSeconds: 90,
    });

    const history = await getEvidenceRecordings();
    expect(history.map((record) => record.id)).toEqual([second.id, first.id]);
    expect(history[0]).toMatchObject({ url: 'https://storage/b.m4a', durationSeconds: 90 });
  });

  it('returns an empty list when nothing has been stored', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValueOnce(null);
    expect(await getEvidenceRecordings()).toEqual([]);
  });

  it('recovers to an empty list if the stored value is malformed', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValueOnce('not json{{');
    expect(await getEvidenceRecordings()).toEqual([]);
  });

  it('clears the stored history', async () => {
    await clearEvidenceRecordingHistory();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('surakshak_evidence_recording_history');
  });
});
