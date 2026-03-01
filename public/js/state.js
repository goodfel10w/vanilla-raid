// ── Centralized State Store ──

const _state = {
  entries: null,  // null = not loaded, [] = loaded empty
  raids: null,
  dkp: {
    balances: [],
    transactions: [],
    config: {
      roles: {},
      defaultDecayPercent: 15,
      maxDkpAmount: 10000,
      allowNegativeBalance: true,
      startingBalance: 0,
      transactionLimit: 50,
      reasonMaxLength: 200,
    },
  },
  auth: {
    user: null,       // { token, username, userId, isAdmin, discordLinked, discordUsername, discordGuildMember }
    bnetCharacters: [],
  },
  ui: {
    view: 'dashboard',
    editId: null,
    heatMode: '1h',
    rosterSort: 'name',
    raidView: 'list',
    raidEditId: null,
    raidForm: { instance: '', date: '', time: '20:00', maxPlayers: 25, notes: '', description: '', deadline: '' },
    raidSizeFilter: 'all',
    raidCalMode: 'list',
    raidCalDate: new Date(),
    dkpView: 'overview',
    dkpSortCol: 'balance',
    dkpSortDir: 'desc',
    dkpPlayerDetail: null,
    dkpSearchQuery: '',
    dkpTxFilter: 'all',
    dkpEditingTx: null,
    dkpAwardPlayers: [],
    dkpAwardAmount: '',
    dkpAwardReason: '',
    dkpAwardRaidId: '',
    dkpSpendPlayer: '',
    dkpSpendAmount: '',
    dkpSpendItem: '',
    dkpDecayPercent: 15,
    dkpRoleAddUser: '',
    dkpRoleAddRole: 'officer',
    adminView: 'overview',
    adminLoaded: false,
    form: { name: '', cls: '', specs: [], roles: [], avail: {}, notes: '' },
    sidebarExpanded: false,
    moreSheetOpen: false,
  },
  admin: {
    users: [],
  },
};

// Subscribers: Map<path, Set<callback>>
const _subs = new Map();

/** Get a value from state by dot-separated path */
export function getState(path) {
  if (!path) return _state;
  const parts = path.split('.');
  let obj = _state;
  for (const p of parts) {
    if (obj == null) return undefined;
    obj = obj[p];
  }
  return obj;
}

/** Set a value in state and notify subscribers */
export function update(path, value) {
  const parts = path.split('.');
  let obj = _state;
  for (let i = 0; i < parts.length - 1; i++) {
    if (obj[parts[i]] == null) obj[parts[i]] = {};
    obj = obj[parts[i]];
  }
  obj[parts[parts.length - 1]] = value;
  _notify(path);
}

/** Subscribe to changes on a state path */
export function subscribe(path, callback) {
  if (!_subs.has(path)) _subs.set(path, new Set());
  _subs.get(path).add(callback);
  return () => _subs.get(path)?.delete(callback);
}

/** Notify all subscribers whose paths match */
function _notify(changedPath) {
  for (const [subPath, cbs] of _subs) {
    // Notify if the changed path starts with or is a parent of the subscribed path
    if (changedPath.startsWith(subPath) || subPath.startsWith(changedPath)) {
      for (const cb of cbs) {
        try { cb(getState(subPath)); } catch (e) { console.error('State subscriber error:', e); }
      }
    }
  }
}

/** Batch multiple updates — runs fn, then notifies. Simple passthrough for now. */
export function batch(fn) {
  fn();
}

// For debugging
if (typeof window !== 'undefined') {
  window.__state = _state;
}
