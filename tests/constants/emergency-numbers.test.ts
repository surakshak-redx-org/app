import { PREDEFINED_EMERGENCY_NUMBERS } from '@/constants/emergency-numbers';

/**
 * CLAUDE.md marks these "Never Modify". This test exists so an accidental edit
 * fails CI rather than shipping a wrong helpline number to someone in danger.
 */
describe('PREDEFINED_EMERGENCY_NUMBERS', () => {
  it('pins the exact government helpline numbers', () => {
    expect(
      PREDEFINED_EMERGENCY_NUMBERS.map(({ id, name, phone, order }) => ({
        id,
        name,
        phone,
        order,
      })),
    ).toEqual([
      { id: 'pre_1', name: 'National Emergency', phone: '112', order: 0 },
      { id: 'pre_2', name: 'Police', phone: '100', order: 1 },
      { id: 'pre_3', name: 'Ambulance', phone: '108', order: 2 },
      { id: 'pre_4', name: 'Women Helpline', phone: '1091', order: 3 },
      { id: 'pre_5', name: 'Mahila Helpline', phone: '181', order: 4 },
      { id: 'pre_6', name: 'Child Helpline', phone: '1098', order: 5 },
      { id: 'pre_7', name: 'Maternity', phone: '102', order: 6 },
    ]);
  });

  it('marks every entry as predefined so the UI refuses to delete them', () => {
    expect(PREDEFINED_EMERGENCY_NUMBERS.every((contact) => contact.isPredefined)).toBe(true);
  });

  it('has no duplicate ids or phone numbers', () => {
    const ids = PREDEFINED_EMERGENCY_NUMBERS.map((contact) => contact.id);
    const phones = PREDEFINED_EMERGENCY_NUMBERS.map((contact) => contact.phone);

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(phones).size).toBe(phones.length);
  });
});
