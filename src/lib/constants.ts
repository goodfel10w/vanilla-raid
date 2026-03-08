export const WOW_ICONS = 'https://cdn.jsdelivr.net/gh/orourkek/Wow-Icons@master/images'

export interface WowClass {
  name: string
  color: string
  icon: string
}

export const CLS: WowClass[] = [
  { name: 'Druide', color: '#FF7C0A', icon: 'druid' },
  { name: 'Hexenmeister', color: '#8788EE', icon: 'warlock' },
  { name: 'Jäger', color: '#AAD372', icon: 'hunter' },
  { name: 'Krieger', color: '#C69B6D', icon: 'warrior' },
  { name: 'Magier', color: '#3FC7EB', icon: 'mage' },
  { name: 'Paladin', color: '#F48CBA', icon: 'paladin' },
  { name: 'Priester', color: '#FFFFFF', icon: 'priest' },
  { name: 'Schamane', color: '#0070DD', icon: 'shaman' },
  { name: 'Schurke', color: '#FFF468', icon: 'rogue' },
]

export type RoleName = 'Tank' | 'Heiler' | 'DPS'

export const ROLES: RoleName[] = ['Tank', 'Heiler', 'DPS']

export const ROLE_ICONS: Record<RoleName, string> = {
  Tank: '🛡️',
  Heiler: '💚',
  DPS: '⚔️',
}

export const ROLE_COLORS: Record<RoleName, string> = {
  Tank: '#5b9bd5',
  Heiler: '#66bb6a',
  DPS: '#e57373',
}

export interface SpecDef {
  name: string
  role: RoleName
  icon: string
}

export const CLASS_SPECS: Record<string, SpecDef[]> = {
  'Druide': [
    { name: 'Balance', role: 'DPS', icon: 'druid/balance' },
    { name: 'Feral Tank', role: 'Tank', icon: 'druid/feral' },
    { name: 'Feral DPS', role: 'DPS', icon: 'druid/feral' },
    { name: 'Resto', role: 'Heiler', icon: 'druid/restoration' },
  ],
  'Hexenmeister': [
    { name: 'Affliction', role: 'DPS', icon: 'warlock/affliction' },
    { name: 'Demonologie', role: 'DPS', icon: 'warlock/demonology' },
    { name: 'Destruction', role: 'DPS', icon: 'warlock/destruction' },
  ],
  'Jäger': [
    { name: 'Beast Mastery', role: 'DPS', icon: 'hunter/beastmastery' },
    { name: 'Marksmanship', role: 'DPS', icon: 'hunter/marksman' },
    { name: 'Survival', role: 'DPS', icon: 'hunter/survival' },
  ],
  'Krieger': [
    { name: 'Prot', role: 'Tank', icon: 'warrior/protection' },
    { name: 'Arms', role: 'DPS', icon: 'warrior/arms' },
    { name: 'Fury', role: 'DPS', icon: 'warrior/fury' },
  ],
  'Magier': [
    { name: 'Arcane', role: 'DPS', icon: 'mage/arcane' },
    { name: 'Fire', role: 'DPS', icon: 'mage/fire' },
    { name: 'Frost', role: 'DPS', icon: 'mage/frost' },
  ],
  'Paladin': [
    { name: 'Holy', role: 'Heiler', icon: 'paladin/holy' },
    { name: 'Prot', role: 'Tank', icon: 'paladin/protection' },
    { name: 'Retri', role: 'DPS', icon: 'paladin/retribution' },
  ],
  'Priester': [
    { name: 'Disc', role: 'Heiler', icon: 'priest/discipline' },
    { name: 'Holy', role: 'Heiler', icon: 'priest/holy' },
    { name: 'Shadow', role: 'DPS', icon: 'priest/shadow' },
  ],
  'Schamane': [
    { name: 'Elemental', role: 'DPS', icon: 'shaman/elemental' },
    { name: 'Enhancement', role: 'DPS', icon: 'shaman/enhancement' },
    { name: 'Resto', role: 'Heiler', icon: 'shaman/restoration' },
  ],
  'Schurke': [
    { name: 'Assassination', role: 'DPS', icon: 'rogue/assassination' },
    { name: 'Combat', role: 'DPS', icon: 'rogue/combat' },
    { name: 'Subtlety', role: 'DPS', icon: 'rogue/subtlety' },
  ],
}

export const WEEKDAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'] as const
export const WEEKEND = ['Samstag', 'Sonntag'] as const
export const DAYS = [...WEEKDAYS, ...WEEKEND] as const
export type DayName = typeof DAYS[number]

export const DAY_SHORT: Record<string, string> = {
  Montag: 'Mo', Dienstag: 'Di', Mittwoch: 'Mi', Donnerstag: 'Do',
  Freitag: 'Fr', Samstag: 'Sa', Sonntag: 'So',
}

// 48 time slots: 15-min increments from 12:00 to 23:45
export const SLOTS: string[] = []
for (let hh = 12; hh < 24; hh++) {
  for (let mm = 0; mm < 60; mm += 15) {
    SLOTS.push(String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'))
  }
}

export const HOUR_LABELS: string[] = []
for (let hh = 12; hh < 24; hh++) {
  HOUR_LABELS.push(String(hh).padStart(2, '0'))
}

export interface TbcBoss {
  name: string
  dkp: number
}

export interface TbcRaid {
  name: string
  maxPlayers: number
  tier: string
  bosses?: TbcBoss[]
}

export const TBC_RAIDS: TbcRaid[] = [
  {
    name: 'Karazhan',
    maxPlayers: 10,
    tier: 'T4',
    bosses: [
      { name: 'Attumen', dkp: 2 },
      { name: 'Moroes', dkp: 2 },
      { name: 'Maiden', dkp: 2 },
      { name: 'Opera', dkp: 2 },
      { name: 'Curator', dkp: 3 },
      { name: 'Schach', dkp: 2 },
      { name: 'Aran', dkp: 3 },
      { name: 'Netherspite', dkp: 3 },
      { name: 'Nightbane', dkp: 3 },
      { name: 'Prinz', dkp: 3 },
    ],
  },
  {
    name: 'Gruuls Unterschlupf',
    maxPlayers: 25,
    tier: 'T4',
    bosses: [
      { name: 'Maulgar', dkp: 3 },
      { name: 'Gruul', dkp: 5 },
    ],
  },
  {
    name: 'Magtheridons Kammer',
    maxPlayers: 25,
    tier: 'T4',
    bosses: [
      { name: 'Magtheridon', dkp: 5 },
    ],
  },
  {
    name: 'Höhle des Schlangenschreins',
    maxPlayers: 25,
    tier: 'T5',
    bosses: [
      { name: 'Hydross', dkp: 5 },
      { name: 'Lurker', dkp: 5 },
      { name: 'Leotheras', dkp: 5 },
      { name: 'Fathom-Lord', dkp: 5 },
      { name: 'Tidewalker', dkp: 5 },
      { name: 'Lady Vashj', dkp: 8 },
    ],
  },
  {
    name: 'Festung der Stürme',
    maxPlayers: 25,
    tier: 'T5',
    bosses: [
      { name: "Al'ar", dkp: 5 },
      { name: 'Void Reaver', dkp: 5 },
      { name: 'Solarian', dkp: 5 },
      { name: "Kael'thas", dkp: 8 },
    ],
  },
  {
    name: 'Hyjalgipfel',
    maxPlayers: 25,
    tier: 'T6',
    bosses: [
      { name: 'Rage Winterchill', dkp: 5 },
      { name: 'Anetheron', dkp: 5 },
      { name: "Kaz'rogal", dkp: 5 },
      { name: 'Azgalor', dkp: 5 },
      { name: 'Archimonde', dkp: 8 },
    ],
  },
  {
    name: 'Schwarzer Tempel',
    maxPlayers: 25,
    tier: 'T6',
    bosses: [
      { name: "Naj'entus", dkp: 5 },
      { name: 'Supremus', dkp: 5 },
      { name: 'Akama', dkp: 5 },
      { name: 'Teron Gorefiend', dkp: 5 },
      { name: 'Gurtogg', dkp: 5 },
      { name: 'Reliquary', dkp: 5 },
      { name: 'Mother Shahraz', dkp: 5 },
      { name: 'Council', dkp: 5 },
      { name: 'Illidan', dkp: 10 },
    ],
  },
  {
    name: "Zul'Aman",
    maxPlayers: 10,
    tier: 'ZA',
    bosses: [
      { name: "Nalorakk", dkp: 3 },
      { name: "Akil'zon", dkp: 3 },
      { name: "Jan'alai", dkp: 3 },
      { name: "Halazzi", dkp: 3 },
      { name: "Hex Lord", dkp: 4 },
      { name: "Zul'jin", dkp: 5 },
    ],
  },
  {
    name: 'Sonnenbrunnenplateau',
    maxPlayers: 25,
    tier: 'T6.5',
    bosses: [
      { name: 'Kalecgos', dkp: 5 },
      { name: 'Brutallus', dkp: 8 },
      { name: 'Felmyst', dkp: 8 },
      { name: 'Eredar Twins', dkp: 8 },
      { name: "M'uru", dkp: 10 },
      { name: "Kil'jaeden", dkp: 10 },
    ],
  },
]

// Raid-ready thresholds (25-man TBC)
export const RR_TANK = 2
export const RR_HEAL = 5
export const RR_DPS = 18
