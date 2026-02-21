let _idCounter = 0;

export const SAMPLE_ENTRY = {
  id: 'test-id-1',
  charName: 'Thrallm\u00e4chtig',
  className: 'Krieger',
  roles: ['Tank'],
  availability: {
    'Montag_18:00': 'yes', 'Montag_18:15': 'yes', 'Montag_18:30': 'yes', 'Montag_18:45': 'yes',
    'Montag_19:00': 'yes', 'Montag_19:15': 'yes', 'Montag_19:30': 'yes', 'Montag_19:45': 'yes',
    'Mittwoch_20:00': 'yes', 'Mittwoch_20:15': 'yes', 'Mittwoch_20:30': 'yes', 'Mittwoch_20:45': 'yes',
    'Mittwoch_21:00': 'yes', 'Mittwoch_21:15': 'yes', 'Mittwoch_21:30': 'yes', 'Mittwoch_21:45': 'yes',
    'Samstag_16:00': 'tentative', 'Samstag_16:15': 'tentative', 'Samstag_16:30': 'tentative', 'Samstag_16:45': 'tentative',
    'Samstag_17:00': 'tentative', 'Samstag_17:15': 'tentative', 'Samstag_17:30': 'tentative', 'Samstag_17:45': 'tentative',
  },
  notes: 'Testnotiz',
  userId: 'mock-user-1',
  timestamp: '2026-01-15T18:00:00.000Z',
};

export const SAMPLE_ENTRY_2 = {
  id: 'test-id-2',
  charName: 'Heiligschein',
  className: 'Priester',
  roles: ['Heiler', 'DPS'],
  availability: {
    'Montag_18:00': 'yes', 'Montag_18:15': 'yes', 'Montag_18:30': 'yes', 'Montag_18:45': 'yes',
    'Montag_19:00': 'yes', 'Montag_19:15': 'yes', 'Montag_19:30': 'yes', 'Montag_19:45': 'yes',
    'Dienstag_20:00': 'yes', 'Dienstag_20:15': 'yes', 'Dienstag_20:30': 'yes', 'Dienstag_20:45': 'yes',
    'Dienstag_21:00': 'yes', 'Dienstag_21:15': 'yes', 'Dienstag_21:30': 'yes', 'Dienstag_21:45': 'yes',
    'Sonntag_14:00': 'yes', 'Sonntag_14:15': 'yes', 'Sonntag_14:30': 'yes', 'Sonntag_14:45': 'yes',
    'Sonntag_15:00': 'yes', 'Sonntag_15:15': 'yes', 'Sonntag_15:30': 'yes', 'Sonntag_15:45': 'yes',
  },
  notes: '',
  userId: 'mock-user-2',
  timestamp: '2026-01-16T10:00:00.000Z',
};

export function makeStoredEntry(overrides = {}) {
  _idCounter += 1;
  return {
    id: `generated-id-${_idCounter}`,
    charName: 'Testchar',
    className: 'Magier',
    roles: ['DPS'],
    availability: {},
    notes: '',
    userId: 'mock-user-1',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}
