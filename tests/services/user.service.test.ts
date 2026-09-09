import {
  addEmergencyContact,
  createUserProfile,
  deleteEmergencyContact,
  getEmergencyContacts,
  getUserProfile,
  updateEmergencyContact,
  updateUserProfile,
  uploadProfilePhoto,
} from '@/services/firebase/user.service';

describe('user.service stubs', () => {
  it.each([
    ['getUserProfile', () => getUserProfile('user-1')],
    [
      'createUserProfile',
      () =>
        createUserProfile('user-1', {
          name: 'Priya',
          phone: '+919876543210',
          city: 'Mumbai',
          language: 'en',
        }),
    ],
    ['updateUserProfile', () => updateUserProfile('user-1', { city: 'Pune' })],
    ['uploadProfilePhoto', () => uploadProfilePhoto('user-1', 'file:///photo.jpg')],
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
  ])('%s rejects until its phase lands', async (_name, call) => {
    await expect(call()).rejects.toThrow('Not implemented');
  });
});
