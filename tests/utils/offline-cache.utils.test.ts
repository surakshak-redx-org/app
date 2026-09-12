import AsyncStorage from '@react-native-async-storage/async-storage';

import { STORAGE_KEYS } from '@/constants/storage';
import type { EmergencyContact } from '@/types/user.types';
import {
  cacheEmergencyContacts,
  cacheUserInfo,
  getCachedEmergencyContacts,
  getCachedUserInfo,
} from '@/utils/offline-cache.utils';

const CUSTOM_CONTACT: EmergencyContact = {
  id: 'c1',
  name: 'Ma',
  phone: '+919876543210',
  relationship: 'Mother',
  isPredefined: false,
  order: 7,
};

describe('cacheEmergencyContacts', () => {
  it('saves the predefined helplines plus the custom contacts', async () => {
    await cacheEmergencyContacts([CUSTOM_CONTACT]);

    const [key, value] = jest.mocked(AsyncStorage.setItem).mock.calls[0] ?? [];
    expect(key).toBe(STORAGE_KEYS.EMERGENCY_CONTACTS_CACHE);
    const saved = JSON.parse(value as string) as EmergencyContact[];
    expect(saved.some((c) => c.id === 'pre_1')).toBe(true);
    expect(saved.some((c) => c.id === 'c1')).toBe(true);
  });
});

describe('getCachedEmergencyContacts', () => {
  it('returns only the predefined numbers when nothing has been cached', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValueOnce(null);

    const result = await getCachedEmergencyContacts();

    expect(result.length).toBeGreaterThan(0);
    expect(result.every((c) => c.isPredefined)).toBe(true);
  });

  it('returns the cached list when one exists', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValueOnce(JSON.stringify([CUSTOM_CONTACT]));

    const result = await getCachedEmergencyContacts();

    expect(result).toEqual([CUSTOM_CONTACT]);
  });

  it('falls back to the predefined numbers on malformed cache data', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValueOnce('not json{{');

    const result = await getCachedEmergencyContacts();

    expect(result.length).toBeGreaterThan(0);
    expect(result.every((c) => c.isPredefined)).toBe(true);
  });
});

describe('cacheUserInfo', () => {
  it('saves the user info correctly', async () => {
    await cacheUserInfo({ userId: 'u1', name: 'Asha', language: 'hi' });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      STORAGE_KEYS.USER_INFO_CACHE,
      JSON.stringify({ userId: 'u1', name: 'Asha', language: 'hi' }),
    );
  });
});

describe('getCachedUserInfo', () => {
  it('returns null when nothing has been cached', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValueOnce(null);

    expect(await getCachedUserInfo()).toBeNull();
  });

  it('returns the cached user when one exists', async () => {
    jest
      .mocked(AsyncStorage.getItem)
      .mockResolvedValueOnce(JSON.stringify({ userId: 'u1', name: 'Asha', language: 'hi' }));

    expect(await getCachedUserInfo()).toEqual({ userId: 'u1', name: 'Asha', language: 'hi' });
  });
});
