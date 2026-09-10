import { deleteDoc, getDoc, setDoc, updateDoc } from '@react-native-firebase/firestore';
import { getDownloadURL, putFile } from '@react-native-firebase/storage';

import {
  addEmergencyContact,
  createUserProfile,
  deleteEmergencyContact,
  deleteUserProfile,
  doesUserExist,
  getEmergencyContacts,
  getUserProfile,
  updateEmergencyContact,
  updateUserProfile,
  uploadProfilePhoto,
} from '@/services/firebase/user.service';

const PROFILE_DATA = {
  name: 'Priya',
  phone: '+919876543210',
  profilePhotoUrl: '',
  city: 'Mumbai',
  state: '',
  language: 'en',
  isGuest: false,
  createdAt: {},
  updatedAt: {},
};

function mockSnapshot(exists: boolean, data: unknown): unknown {
  return { exists: () => exists, id: 'user-1', data: () => data };
}

let errorSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  errorSpy.mockRestore();
});

describe('getUserProfile', () => {
  it('returns null when the document has no data', async () => {
    jest.mocked(getDoc).mockResolvedValueOnce(mockSnapshot(false, undefined) as never);
    await expect(getUserProfile('user-1')).resolves.toBeNull();
  });

  it('returns the profile with userId merged in', async () => {
    jest.mocked(getDoc).mockResolvedValueOnce(mockSnapshot(true, PROFILE_DATA) as never);
    await expect(getUserProfile('user-1')).resolves.toMatchObject({
      userId: 'user-1',
      name: 'Priya',
      city: 'Mumbai',
    });
  });
});

describe('createUserProfile', () => {
  it('writes isGuest:false, an empty state, and server timestamps', async () => {
    jest.mocked(getDoc).mockResolvedValueOnce(mockSnapshot(true, PROFILE_DATA) as never);

    await createUserProfile('user-1', {
      name: 'Priya',
      phone: '+919876543210',
      city: 'Mumbai',
      language: 'en',
      profilePhotoUrl: '',
    });

    expect(setDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        isGuest: false,
        state: '',
        createdAt: expect.anything(),
        updatedAt: expect.anything(),
      }),
    );
  });
});

describe('updateUserProfile', () => {
  it('always includes updatedAt in the update payload', async () => {
    await updateUserProfile('user-1', { city: 'Pune' });

    expect(updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ city: 'Pune', updatedAt: expect.anything() }),
    );
  });
});

describe('doesUserExist', () => {
  it('returns false when the document does not exist', async () => {
    jest.mocked(getDoc).mockResolvedValueOnce(mockSnapshot(false, undefined) as never);
    await expect(doesUserExist('user-1')).resolves.toBe(false);
  });

  it('returns true when the document exists', async () => {
    jest.mocked(getDoc).mockResolvedValueOnce(mockSnapshot(true, PROFILE_DATA) as never);
    await expect(doesUserExist('user-1')).resolves.toBe(true);
  });
});

describe('deleteUserProfile', () => {
  it('deletes the user document', async () => {
    await deleteUserProfile('user-1');
    expect(deleteDoc).toHaveBeenCalled();
  });
});

describe('uploadProfilePhoto', () => {
  it('uploads the file and returns its download URL', async () => {
    jest.mocked(getDownloadURL).mockResolvedValueOnce('https://cdn/avatar.jpg');

    await expect(uploadProfilePhoto('user-1', 'file:///photo.jpg')).resolves.toBe(
      'https://cdn/avatar.jpg',
    );
    expect(putFile).toHaveBeenCalled();
  });
});

describe('error propagation', () => {
  it('createUserProfile throws when the read-back returns nothing', async () => {
    jest.mocked(getDoc).mockResolvedValueOnce(mockSnapshot(false, undefined) as never);

    await expect(
      createUserProfile('user-1', {
        name: 'Priya',
        phone: '+919876543210',
        city: 'Mumbai',
        language: 'en',
        profilePhotoUrl: '',
      }),
    ).rejects.toThrow('profile not found after write');
  });

  it.each([
    ['getUserProfile', (): Promise<unknown> => getUserProfile('user-1'), getDoc],
    ['doesUserExist', (): Promise<unknown> => doesUserExist('user-1'), getDoc],
    ['updateUserProfile', (): Promise<unknown> => updateUserProfile('user-1', {}), updateDoc],
    ['deleteUserProfile', (): Promise<unknown> => deleteUserProfile('user-1'), deleteDoc],
    [
      'uploadProfilePhoto',
      (): Promise<unknown> => uploadProfilePhoto('user-1', 'file:///x.jpg'),
      putFile,
    ],
  ])('%s logs and rethrows when Firebase fails', async (_name, call, mockFn) => {
    (mockFn as jest.Mock).mockRejectedValueOnce(new Error('firestore down'));

    await expect(call()).rejects.toThrow('firestore down');
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe('emergency contact stubs (Phase 3)', () => {
  it.each([
    ['getEmergencyContacts', () => getEmergencyContacts('user-1')],
    [
      'addEmergencyContact',
      () =>
        addEmergencyContact('user-1', {
          name: 'Ma',
          phone: '+919876543210',
          relationship: 'Mother',
          isPredefined: false,
          order: 7,
        }),
    ],
    [
      'updateEmergencyContact',
      () => updateEmergencyContact('user-1', 'contact-1', { name: 'Mummy' }),
    ],
    ['deleteEmergencyContact', () => deleteEmergencyContact('user-1', 'contact-1')],
  ])('%s rejects until Phase 3 lands', async (_name, call) => {
    await expect(call()).rejects.toThrow('Not implemented');
  });
});
