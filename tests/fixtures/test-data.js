let _idCounter = 0;

export const SAMPLE_ENTRY = {
  id: 'test-id-1',
  charName: 'Thrallm\u00e4chtig',
  className: 'Krieger',
  roles: ['Tank'],
  availability: {
    'Montag_18:00\u201320:00': 'yes',
    'Mittwoch_20:00\u201322:00': 'yes',
    'Samstag_16:00\u201318:00': 'tentative',
  },
  notes: 'Testnotiz',
  timestamp: '2026-01-15T18:00:00.000Z',
};

export const SAMPLE_ENTRY_2 = {
  id: 'test-id-2',
  charName: 'Heiligschein',
  className: 'Priester',
  roles: ['Heiler', 'DPS'],
  availability: {
    'Montag_18:00\u201320:00': 'yes',
    'Dienstag_20:00\u201322:00': 'yes',
    'Sonntag_14:00\u201316:00': 'yes',
  },
  notes: '',
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
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}
