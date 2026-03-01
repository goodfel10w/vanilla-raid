// ── Kara Groups View ──

import { getState, update, subscribe } from '../state.js';
import { h, cc, clsIcon, specRole } from '../utils.js';
import { ROLES, ROLE_ICONS, ROLE_COLORS, DAYS, SLOTS, DAY_SHORT, HOUR_LABELS } from '../constants.js';
import { showConfirm } from '../components/modal.js';
import { toast } from '../components/toast.js';

const KARA_SIZE = 10;
const KARA_GROUPS_COUNT = 3;
const KARA_TANKS = 2, KARA_HEALERS = 3, KARA_DPS = 5;

let _unsub = [];
let karaWeekOffset = 0;
let karaGroups = [[], [], []];
let karaGroupSlots = ['', '', ''];
let karaLinks = [];
let karaShowExport = false;

export function render(container) {
  _unsub.forEach(u => u());
  _unsub = [];
  _loadKaraState();
  _renderKara(container);
  _unsub.push(subscribe('entries', () => _renderKara(container)));
}

export function unmount() {
  _unsub.forEach(u => u());
  _unsub = [];
}

function _karaStorageKey() {
  return `kara-groups-week-${karaWeekOffset}`;
}

function _loadKaraState() {
  try {
    const stored = localStorage.getItem(_karaStorageKey());
    if (stored) {
      const data = JSON.parse(stored);
      karaGroups = data.groups || [[], [], []];
      karaGroupSlots = data.slots || ['', '', ''];
      karaLinks = data.links || [];
    } else {
      karaGroups = [[], [], []];
      karaGroupSlots = ['', '', ''];
      karaLinks = [];
    }
  } catch {
    karaGroups = [[], [], []];
    karaGroupSlots = ['', '', ''];
    karaLinks = [];
  }
}

function _saveKaraState() {
  localStorage.setItem(_karaStorageKey(), JSON.stringify({
    groups: karaGroups,
    slots: karaGroupSlots,
    links: karaLinks,
  }));
}

function _assignedIds() {
  const set = new Set();
  karaGroups.forEach(g => g.forEach(p => set.add(p.entryId)));
  return set;
}

function _groupRoles(group) {
  const entries = getState('entries') || [];
  let t = 0, hl = 0, dp = 0;
  group.forEach(p => {
    const entry = entries.find(e => e.id === p.entryId);
    if (!entry) return;
    const roles = entry.roles || [];
    if (roles.includes('Tank')) t++;
    if (roles.includes('Heiler')) hl++;
    if (roles.includes('DPS')) dp++;
  });
  return { t, hl, dp };
}

function _renderKara(container) {
  const entries = getState('entries') || [];
  const assignedIds = _assignedIds();
  const pool = entries.filter(e => !assignedIds.has(e.id));

  let html = `<div class="kara-header">
    <div class="kara-week-nav">
      <button class="btn-icon" id="kara-prev">\u2190</button>
      <span class="kara-week-label">ID-Woche ${karaWeekOffset === 0 ? '(aktuell)' : (karaWeekOffset > 0 ? '+' + karaWeekOffset : karaWeekOffset)}</span>
      <button class="btn-icon" id="kara-next">\u2192</button>
    </div>
    <div class="kara-actions">
      <button class="kara-btn" id="kara-auto"><span class="material-symbols-outlined" style="font-size:16px;vertical-align:middle">casino</span> Auto-Verteilen</button>
      <button class="kara-btn" id="kara-export"><span class="material-symbols-outlined" style="font-size:16px;vertical-align:middle">content_paste</span> Export</button>
      <button class="kara-btn" id="kara-reset"><span class="material-symbols-outlined" style="font-size:16px;vertical-align:middle">delete</span> Reset</button>
    </div>
  </div>`;

  // Layout: Pool + 3 Groups
  html += '<div class="kara-layout">';

  // Pool
  html += `<div class="card kara-pool">
    <div class="kara-group-hdr">
      <span>Pool</span>
      <span class="kara-group-count">${pool.length}</span>
    </div>
    <div class="kara-dropzone pool-zone" data-group="-1">`;
  if (pool.length) {
    pool.forEach(e => {
      html += _playerCard(e, false);
    });
  } else {
    html += '<div class="kara-empty">Alle verteilt</div>';
  }
  html += '</div></div>';

  // 3 Groups
  for (let gi = 0; gi < KARA_GROUPS_COUNT; gi++) {
    const group = karaGroups[gi] || [];
    const roles = _groupRoles(group);
    const slot = karaGroupSlots[gi];
    html += `<div class="card kara-group">
      <div class="kara-group-hdr">
        <span style="color:var(--color-accent)">Karazhan ${gi + 1}</span>
        <span class="kara-group-count">${group.length}/${KARA_SIZE}</span>
      </div>
      <div class="kara-role">
        <span style="color:var(--color-role-tank)">${roles.t}T</span>
        <span style="color:var(--color-role-healer)">${roles.hl}H</span>
        <span style="color:var(--color-role-dps)">${roles.dp}D</span>
      </div>
      ${slot ? `<div style="font-size:11px;color:var(--color-text-muted);margin:4px 0">${slot}</div>` : ''}
      <div class="kara-dropzone" data-group="${gi}">`;
    if (group.length) {
      group.forEach(p => {
        const entry = entries.find(e => e.id === p.entryId);
        if (entry) html += _playerCard(entry, p.pinned, gi);
      });
    } else {
      html += '<div class="kara-empty">Spieler hierher ziehen</div>';
    }
    html += '</div></div>';
  }
  html += '</div>';

  // Export
  if (karaShowExport) {
    html += _exportHtml(entries);
  }

  container.innerHTML = html;
  _attachEvents(container, entries);
}

function _playerCard(entry, pinned, groupIndex) {
  const role = (entry.roles || [])[0] || 'DPS';
  return `<div class="kara-player-card${pinned ? ' pinned' : ''}" draggable="true" data-entry-id="${entry.id}" data-group="${groupIndex !== undefined ? groupIndex : -1}">
    <img class="wow-ico-sm" src="${clsIcon(entry.className)}" alt="" loading="lazy">
    <span style="color:${cc(entry.className)};font-weight:600">${h(entry.charName)}</span>
    <span style="font-size:10px;color:${ROLE_COLORS[role]}">${role}</span>
    ${pinned ? '<span title="Gepinnt"><span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle">push_pin</span></span>' : ''}
  </div>`;
}

function _attachEvents(container, entries) {
  // Week navigation
  container.querySelector('#kara-prev')?.addEventListener('click', () => {
    karaWeekOffset--;
    _loadKaraState();
    _renderKara(container);
  });
  container.querySelector('#kara-next')?.addEventListener('click', () => {
    karaWeekOffset++;
    _loadKaraState();
    _renderKara(container);
  });

  // Auto generate
  container.querySelector('#kara-auto')?.addEventListener('click', () => {
    _autoGenerate(entries);
    _renderKara(container);
  });

  // Export toggle
  container.querySelector('#kara-export')?.addEventListener('click', () => {
    karaShowExport = !karaShowExport;
    _renderKara(container);
  });

  // Reset
  container.querySelector('#kara-reset')?.addEventListener('click', () => {
    showConfirm('Gruppen zurücksetzen', 'Alle Zuweisungen für diese ID-Woche werden gelöscht.', () => {
      karaGroups = [[], [], []];
      karaGroupSlots = ['', '', ''];
      karaLinks = [];
      _saveKaraState();
      _renderKara(container);
      toast('Gruppen zurückgesetzt');
    });
  });

  // Copy export
  container.querySelector('#kara-copy')?.addEventListener('click', () => {
    const pre = container.querySelector('#kara-export-text');
    if (pre) {
      navigator.clipboard.writeText(pre.textContent).then(() => toast('Kopiert')).catch(() => toast('Kopieren fehlgeschlagen'));
    }
  });

  // Drag and drop
  const dropzones = container.querySelectorAll('.kara-dropzone');
  const cards = container.querySelectorAll('.kara-player-card');

  cards.forEach(card => {
    card.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', card.dataset.entryId);
      e.dataTransfer.effectAllowed = 'move';
      card.style.opacity = '0.5';
    });
    card.addEventListener('dragend', () => { card.style.opacity = '1'; });
  });

  dropzones.forEach(zone => {
    zone.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => { zone.classList.remove('drag-over'); });
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const entryId = e.dataTransfer.getData('text/plain');
      const targetGroup = parseInt(zone.dataset.group);
      _movePlayer(entryId, targetGroup);
      _renderKara(container);
    });
  });
}

function _movePlayer(entryId, targetGroup) {
  // Remove from current position
  for (let gi = 0; gi < KARA_GROUPS_COUNT; gi++) {
    karaGroups[gi] = karaGroups[gi].filter(p => p.entryId !== entryId);
  }
  // Add to target group (unless pool = -1)
  if (targetGroup >= 0 && targetGroup < KARA_GROUPS_COUNT) {
    if (karaGroups[targetGroup].length < KARA_SIZE) {
      karaGroups[targetGroup].push({ entryId, pinned: false });
    }
  }
  _saveKaraState();
}

function _autoGenerate(entries) {
  karaGroups = [[], [], []];

  // Sort by role priority (Tank > Heiler > DPS)
  const rolePriority = { Tank: 0, Heiler: 1, DPS: 2 };
  const sorted = [...entries].sort((a, b) => {
    const ra = (a.roles || [])[0] || 'DPS';
    const rb = (b.roles || [])[0] || 'DPS';
    return (rolePriority[ra] || 2) - (rolePriority[rb] || 2);
  });

  // Distribute: place each player in the group that needs their role most
  sorted.forEach(e => {
    const role = (e.roles || [])[0] || 'DPS';
    let bestGroup = -1, bestScore = -1;
    for (let gi = 0; gi < KARA_GROUPS_COUNT; gi++) {
      if (karaGroups[gi].length >= KARA_SIZE) continue;
      const roles = _groupRoles(karaGroups[gi]);
      let need = 0;
      if (role === 'Tank') need = KARA_TANKS - roles.t;
      else if (role === 'Heiler') need = KARA_HEALERS - roles.hl;
      else need = KARA_DPS - roles.dp;
      const sizeScore = KARA_SIZE - karaGroups[gi].length;
      const score = need * 10 + sizeScore;
      if (score > bestScore) { bestScore = score; bestGroup = gi; }
    }
    if (bestGroup >= 0) {
      karaGroups[bestGroup].push({ entryId: e.id, pinned: false });
    }
  });

  _saveKaraState();
  const totalPlaced = karaGroups.reduce((s, g) => s + g.length, 0);
  toast(`${totalPlaced} Spieler verteilt`);
}

function _exportHtml(entries) {
  let text = `**Karazhan Gruppen — ID-Woche ${karaWeekOffset}**\n\n`;
  for (let gi = 0; gi < KARA_GROUPS_COUNT; gi++) {
    const group = karaGroups[gi] || [];
    const roles = _groupRoles(group);
    const slot = karaGroupSlots[gi];
    text += `__Karazhan ${gi + 1}__`;
    if (slot) text += ` — ${slot}`;
    text += ` (${roles.t}T/${roles.hl}H/${roles.dp}D)\n`;
    if (!group.length) {
      text += '  (leer)\n';
    } else {
      group.forEach(p => {
        const entry = entries.find(e => e.id === p.entryId);
        if (!entry) return;
        const role = (entry.roles || [])[0] || 'DPS';
        const spec = (entry.specs || [])[0] || '';
        text += `  ${entry.charName} — ${entry.className}${spec ? ' (' + spec + ')' : ''} [${role}]${p.pinned ? ' \u{1F4CC}' : ''}\n`;
      });
    }
    text += '\n';
  }

  const assignedIds = _assignedIds();
  const unassigned = entries.filter(e => !assignedIds.has(e.id));
  if (unassigned.length) {
    text += `__Nicht eingeteilt (${unassigned.length}):__\n`;
    unassigned.forEach(e => { text += `  ${e.charName} — ${e.className}\n`; });
  }

  return `<div class="kara-export-area card">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <span class="sec-label">Export</span>
      <button class="kara-btn" id="kara-copy"><span class="material-symbols-outlined" style="font-size:16px;vertical-align:middle">content_paste</span> Kopieren</button>
    </div>
    <pre id="kara-export-text">${h(text)}</pre>
  </div>`;
}
