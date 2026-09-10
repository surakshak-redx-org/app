import {
  addDoc,
  deleteDoc,
  getDoc,
  getDocs,
  orderBy,
  setDoc,
  updateDoc,
  writeBatch,
} from '@react-native-firebase/firestore';
import { getDownloadURL, putFile } from '@react-native-firebase/storage';

import {
  addEmergencyContact,
  createUserProfile,
  deleteEmergencyContact,
  deleteUserProfile,
  doesUserExist,
  getEmergencyContacts,
  getUserProfile,
  reorderEmergencyContacts,
  updateEmergencyContact,
  updateUserProfile,
  uploadProfilePhoto,
} from '@/services/firebase/user.service';

// The global firestore mock in tests/setup.ts predates subcollection code, so
// this suite supplies the query/collection/batch surface user.service now uses.
jest.mock('@react-native-firebase/firestore', () => {
  const batch = { update: jest.fn(), commit: jest.fn(() => Promise.resolve()) };
  return {
    getFirestore: jest.fn(() => ({})),
    doc: jest.fn((...segments: string[]) => ({ path: segments.join('/') })),
    collection: jest.fn((...segments: string[]) => ({ path: segments.join('/') })),
    getDoc: jest.fn(() =>
      Promise.resolve({ exists: () => false, id: 'test-uid', data: () => undefined }),
    ),
    getDocs: jest.fn(() => Promise.resolve({ docs: [] })),
    addDoc: jest.fn(() => Promise.resolve({ id: 'new-contact-id' })),
    setDoc: jest.fn(() => Promise.resolve()),
    updateDoc: jest.fn(() => Promise.resolve()),
    deleteDoc: jest.fn(() => Promise.resolve()),
    query: jest.fn((ref: unknown) => ref),
    orderBy: jest.fn((field: string, direction: string) => ({ field, direction })),
    writeBatch: jest.fn(() => batch),
    serverTimestamp: jest.fn(() => ({ __serverTimestamp: true })),
  };
});

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

describe('emergency contacts', () => {
  it('reads the subcollection ordered by `order` ascending', async () => {
    jest.mocked(getDocs).mockResolvedValueOnce({
      docs: [
        { id: 'c1', data: () => ({ name: 'Ma', phone: '+91987', order: 0 }) },
        { id: 'c2', data: () => ({ name: 'Bhai', phone: '+91988', order: 1 }) },
      ],
    } as never);

    const contacts = await getEmergencyContacts('user-1');

    expect(orderBy).toHaveBeenCalledWith('order', 'asc');
    expect(contacts).toEqual([
      { id: 'c1', name: 'Ma', phone: '+91987', order: 0 },
      { id: 'c2', name: 'Bhai', phone: '+91988', order: 1 },
    ]);
  });

  it('returns the new contact with its generated id', async () => {
    jest.mocked(addDoc).mockResolvedValueOnce({ id: 'generated-1' } as never);

    const created = await addEmergencyContact('user-1', {
      name: 'Ma',
      phone: '+919876543210',
      relationship: 'Mother',
      isPredefined: false,
      order: 7,
    });

    expect(created).toEqual({
      id: 'generated-1',
      name: 'Ma',
      phone: '+919876543210',
      relationship: 'Mother',
      isPredefined: false,
      order: 7,
    });
  });

  it('updates and deletes a single contact document', async () => {
    await updateEmergencyContact('user-1', 'contact-1', { name: 'Mummy' });
    expect(updateDoc).toHaveBeenCalledWith(expect.anything(), { name: 'Mummy' });

    await deleteEmergencyContact('user-1', 'contact-1');
    expect(deleteDoc).toHaveBeenCalled();
  });

  it('reorders every contact in one batch', async () => {
    await reorderEmergencyContacts('user-1', [
      { id: 'c2', name: 'B', phone: '+91', relationship: '', isPredefined: false, order: 1 },
      { id: 'c1', name: 'A', phone: '+91', relationship: '', isPredefined: false, order: 0 },
    ]);

    const batch = jest.mocked(writeBatch).mock.results[0]?.value as {
      update: jest.Mock;
      commit: jest.Mock;
    };
    expect(batch.update).toHaveBeenCalledTimes(2);
    expect(batch.update).toHaveBeenLastCalledWith(expect.anything(), { order: 1 });
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['getEmergencyContacts', (): Promise<unknown> => getEmergencyContacts('user-1'), getDocs],
    [
      'addEmergencyContact',
      (): Promise<unknown> =>
        addEmergencyContact('user-1', {
          name: 'Ma',
          phone: '+91',
          relationship: 'Mother',
          isPredefined: false,
          order: 0,
        }),
      addDoc,
    ],
  ])('%s logs and rethrows when Firestore fails', async (_name, call, mockFn) => {
    (mockFn as jest.Mock).mockRejectedValueOnce(new Error('firestore down'));
    await expect(call()).rejects.toThrow('firestore down');
    expect(errorSpy).toHaveBeenCalled();
  });
});
