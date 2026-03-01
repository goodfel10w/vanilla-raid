// ── Constants ──

export const WOW_ICONS = 'https://cdn.jsdelivr.net/gh/orourkek/Wow-Icons@master/images';

export const CLS = [
  { n: 'Druide', c: '#FF7C0A', i: 'druid' },
  { n: 'Hexenmeister', c: '#8788EE', i: 'warlock' },
  { n: 'Jäger', c: '#AAD372', i: 'hunter' },
  { n: 'Krieger', c: '#C69B6D', i: 'warrior' },
  { n: 'Magier', c: '#3FC7EB', i: 'mage' },
  { n: 'Paladin', c: '#F48CBA', i: 'paladin' },
  { n: 'Priester', c: '#FFFFFF', i: 'priest' },
  { n: 'Schamane', c: '#0070DD', i: 'shaman' },
  { n: 'Schurke', c: '#FFF468', i: 'rogue' },
];

export const ROLES = ['Tank', 'Heiler', 'DPS'];

export const ROLE_ICONS = { Tank: '<span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle">shield</span>', Heiler: '<span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle">favorite</span>', DPS: '<span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle">swords</span>' };

export const ROLE_COLORS = { Tank: '#5b9bd5', Heiler: '#66bb6a', DPS: '#e57373' };

export const CLASS_SPECS = {
  'Druide': [
    { n: 'Balance', r: 'DPS', i: 'druid/balance' },
    { n: 'Feral Tank', r: 'Tank', i: 'druid/feral' },
    { n: 'Feral DPS', r: 'DPS', i: 'druid/feral' },
    { n: 'Resto', r: 'Heiler', i: 'druid/restoration' },
  ],
  'Hexenmeister': [
    { n: 'Affliction', r: 'DPS', i: 'warlock/affliction' },
    { n: 'Demonologie', r: 'DPS', i: 'warlock/demonology' },
    { n: 'Destruction', r: 'DPS', i: 'warlock/destruction' },
  ],
  'Jäger': [
    { n: 'Beast Mastery', r: 'DPS', i: 'hunter/beastmastery' },
    { n: 'Marksmanship', r: 'DPS', i: 'hunter/marksman' },
    { n: 'Survival', r: 'DPS', i: 'hunter/survival' },
  ],
  'Krieger': [
    { n: 'Prot', r: 'Tank', i: 'warrior/protection' },
    { n: 'Arms', r: 'DPS', i: 'warrior/arms' },
    { n: 'Fury', r: 'DPS', i: 'warrior/fury' },
  ],
  'Magier': [
    { n: 'Arcane', r: 'DPS', i: 'mage/arcane' },
    { n: 'Fire', r: 'DPS', i: 'mage/fire' },
    { n: 'Frost', r: 'DPS', i: 'mage/frost' },
  ],
  'Paladin': [
    { n: 'Holy', r: 'Heiler', i: 'paladin/holy' },
    { n: 'Prot', r: 'Tank', i: 'paladin/protection' },
    { n: 'Retri', r: 'DPS', i: 'paladin/retribution' },
  ],
  'Priester': [
    { n: 'Disc', r: 'Heiler', i: 'priest/discipline' },
    { n: 'Holy', r: 'Heiler', i: 'priest/holy' },
    { n: 'Shadow', r: 'DPS', i: 'priest/shadow' },
  ],
  'Schamane': [
    { n: 'Elemental', r: 'DPS', i: 'shaman/elemental' },
    { n: 'Enhancement', r: 'DPS', i: 'shaman/enhancement' },
    { n: 'Resto', r: 'Heiler', i: 'shaman/restoration' },
  ],
  'Schurke': [
    { n: 'Assassination', r: 'DPS', i: 'rogue/assassination' },
    { n: 'Combat', r: 'DPS', i: 'rogue/combat' },
    { n: 'Subtlety', r: 'DPS', i: 'rogue/subtlety' },
  ],
};

export const WD = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'];
export const WE = ['Samstag', 'Sonntag'];
export const DAYS = [...WD, ...WE];

export const DAY_SHORT = {
  Montag: 'Mo', Dienstag: 'Di', Mittwoch: 'Mi',
  Donnerstag: 'Do', Freitag: 'Fr', Samstag: 'Sa', Sonntag: 'So',
};

// 15-min slots from 12:00 to 23:45 (48 slots)
export const SLOTS = [];
for (let hh = 12; hh < 24; hh++) {
  for (let mm = 0; mm < 60; mm += 15) {
    SLOTS.push(String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'));
  }
}

export const HOUR_LABELS = [];
for (let hh = 12; hh < 24; hh++) {
  HOUR_LABELS.push(String(hh).padStart(2, '0'));
}

export const TBC_RAIDS = [
  { n: 'Karazhan', max: 10, tier: 'T4' },
  { n: 'Gruuls Unterschlupf', max: 25, tier: 'T4' },
  { n: 'Magtheridons Kammer', max: 25, tier: 'T4' },
  { n: 'Höhle des Schlangenschreins', max: 25, tier: 'T5' },
  { n: 'Festung der Stürme', max: 25, tier: 'T5' },
  { n: 'Hyjalgipfel', max: 25, tier: 'T6' },
  { n: 'Schwarzer Tempel', max: 25, tier: 'T6' },
  { n: "Zul'Aman", max: 10, tier: 'ZA' },
  { n: 'Sonnenbrunnenplateau', max: 25, tier: 'T6.5' },
];

// Raid-ready thresholds (25-man TBC)
export const RR_TANK = 2;
export const RR_HEAL = 5;
export const RR_DPS = 18;

// Battle.net SSO SVG icon
export const BNET_ICON = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm5.82 16.12c-.32.5-.87.82-1.5.87-.12.01-.25 0-.37-.02.04-.14.07-.28.09-.43.15-.92-.12-2.08-.72-3.26l-.18-.35c-.36.83-.96 1.75-1.76 2.6-1.22 1.3-2.61 2.14-3.67 2.35.18.12.37.22.58.28-.37.3-.82.47-1.3.47-.48 0-.94-.17-1.3-.49a1.94 1.94 0 01-.6-1.63l.04-.27c.78.42 1.87.56 3.1.32 1.45-.28 2.98-1.07 4.28-2.27a12.5 12.5 0 002.4-2.92c-.62-.98-1.47-1.85-2.52-2.52l-.32-.19c.52-.69 1.17-1.3 1.9-1.75-.63-.35-1.33-.6-2.08-.72l-.28-.04c.48-.32 1.05-.52 1.67-.52.63 0 1.22.2 1.7.56a1.94 1.94 0 01.72 1.53c0 .1-.01.2-.03.3-.86-.23-1.88-.16-2.95.24-1.26.47-2.46 1.33-3.4 2.42a12.5 12.5 0 00-1.97 3.17c1.08.63 2.33 1.01 3.68 1.01h.38c-.2.14-.41.27-.63.38l.03.02c.52.14 1.12.1 1.68-.16.7-.33 1.3-.97 1.58-1.73z" fill="currentColor"/></svg>`;

// Discord icon SVG
export const DISCORD_ICON = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" fill="currentColor"/></svg>`;
