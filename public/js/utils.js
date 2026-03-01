// ── Utility Functions ──

import { CLS, CLASS_SPECS, ROLES, SLOTS, WOW_ICONS } from './constants.js';

/** HTML-escape a string */
export function h(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Get class color by name */
export function cc(name) {
  return CLS.find(c => c.n === name)?.c || '#ccc';
}

/** Get class icon URL */
export function clsIcon(cls) {
  const c = CLS.find(x => x.n === cls);
  return c ? `${WOW_ICONS}/class/64/${c.i}.png` : '';
}

/** Get spec icon URL */
export function specIcon(cls, specName) {
  const sp = (CLASS_SPECS[cls] || []).find(s => s.n === specName);
  return sp ? `${WOW_ICONS}/spec/${sp.i}.png` : '';
}

/** Get role for a spec */
export function specRole(cls, specName) {
  const sp = (CLASS_SPECS[cls] || []).find(c => c.n === specName);
  return sp ? sp.r : 'DPS';
}

/** Convert spec selections to roles */
export function specsToRoles(cls, specs) {
  const cspecs = CLASS_SPECS[cls] || [];
  const rs = new Set();
  (specs || []).forEach(s => {
    const sp = cspecs.find(c => c.n === s);
    if (sp) rs.add(sp.r);
  });
  return ROLES.filter(r => rs.has(r));
}

/** Infer specs from roles for legacy entries */
export function inferSpecs(cls, roles) {
  const cspecs = CLASS_SPECS[cls] || [];
  if (!roles || !roles.length) return [];
  const out = [];
  roles.forEach(r => {
    const matching = cspecs.filter(s => s.r === r);
    if (matching.length === 1) out.push(matching[0].n);
  });
  return out;
}

/** Add minutes to a time string "HH:MM" */
export function addMins(t, m) {
  const [hh, mm] = t.split(':').map(Number);
  const s = hh * 60 + mm + m;
  return String(Math.floor(s / 60) % 24).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

/** Get quarter-hour slots for an hour label */
export function hourQuarters(hLabel) {
  return [0, 15, 30, 45].map(m => hLabel + ':' + String(m).padStart(2, '0'));
}

/** Collapse availability into ranges for display */
export function collapseRanges(avail, day) {
  const ds = SLOTS.filter(s => avail[day + '_' + s]);
  if (!ds.length) return [];
  const ranges = [];
  let rs = ds[0], re = ds[0], rt = avail[day + '_' + ds[0]];
  for (let i = 1; i < ds.length; i++) {
    const s = ds[i], v = avail[day + '_' + s];
    if (SLOTS.indexOf(s) === SLOTS.indexOf(re) + 1 && v === rt) {
      re = s;
    } else {
      ranges.push({ start: rs, end: addMins(re, 15), type: rt });
      rs = s; re = s; rt = v;
    }
  }
  ranges.push({ start: rs, end: addMins(re, 15), type: rt });
  return ranges;
}

/** Migrate legacy availability format */
export function migrateLegacyAvail(av) {
  if (!av || typeof av !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(av)) {
    const sep = k.indexOf('_');
    if (sep < 0) continue;
    const day = k.substring(0, sep), slot = k.substring(sep + 1), val = v === true ? 'yes' : v;
    if (slot.includes('\u2013')) {
      const [st, en] = slot.split('\u2013');
      const [sh, sm] = st.split(':').map(Number);
      let [eh, em] = en.split(':').map(Number);
      if (eh === 0 && em === 0) eh = 24;
      for (let t = sh * 60 + sm; t < eh * 60 + em; t += 15) {
        const tk = String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
        out[day + '_' + tk] = val;
      }
    } else {
      out[k] = val;
    }
  }
  return out;
}

/** Check raid readiness from player list */
export function isRaidReady(players) {
  let t = 0, hl = 0, dp = 0;
  players.forEach(p => {
    const roles = p.roles || [];
    if (roles.includes('Tank')) t++;
    if (roles.includes('Heiler')) hl++;
    if (roles.includes('DPS')) dp++;
  });
  return { t, hl, dp, ready: t >= 2 && hl >= 5 && dp >= 18 };
}

/** Convert [Item Name] to Wowhead tooltip links */
export function linkItems(text) {
  if (!text) return '';
  const escaped = h(text);
  return escaped.replace(/\[([^\]]+)\]/g, function (_, name) {
    const q = encodeURIComponent(
      name.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    );
    return '<a class="item-link" href="https://www.wowhead.com/tbc/search?q=' + q + '" target="_blank" rel="noopener">' + name + '</a>';
  });
}

/** Format date to German locale string */
export function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Format ISO timestamp to relative time */
export function timeAgo(ts) {
  const now = Date.now();
  const diff = now - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'gerade eben';
  if (mins < 60) return `vor ${mins} Min.`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  return `vor ${days} Tag${days > 1 ? 'en' : ''}`;
}
