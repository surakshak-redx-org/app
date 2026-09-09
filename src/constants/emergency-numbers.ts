import type { EmergencyContact } from '@/types/user.types';

/**
 * Government helpline numbers for India. These are never editable by the user
 * and must not be modified — see CLAUDE.md "Emergency Numbers (Never Modify)".
 */
export const PREDEFINED_EMERGENCY_NUMBERS: readonly EmergencyContact[] = [
  {
    id: 'pre_1',
    name: 'National Emergency',
    phone: '112',
    relationship: '',
    isPredefined: true,
    order: 0,
  },
  { id: 'pre_2', name: 'Police', phone: '100', relationship: '', isPredefined: true, order: 1 },
  { id: 'pre_3', name: 'Ambulance', phone: '108', relationship: '', isPredefined: true, order: 2 },
  {
    id: 'pre_4',
    name: 'Women Helpline',
    phone: '1091',
    relationship: '',
    isPredefined: true,
    order: 3,
  },
  {
    id: 'pre_5',
    name: 'Mahila Helpline',
    phone: '181',
    relationship: '',
    isPredefined: true,
    order: 4,
  },
  {
    id: 'pre_6',
    name: 'Child Helpline',
    phone: '1098',
    relationship: '',
    isPredefined: true,
    order: 5,
  },
  { id: 'pre_7', name: 'Maternity', phone: '102', relationship: '', isPredefined: true, order: 6 },
] as const;
