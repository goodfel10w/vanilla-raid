// ── Raids View ──

import { getState, update, subscribe } from '../state.js';
import { api, RAIDS_API } from '../api.js';
import { h, cc, clsIcon, specIcon, formatDate } from '../utils.js';
import { CLS, TBC_RAIDS, ROLES, ROLE_ICONS, ROLE_COLORS, BNET_ICON, WOW_ICONS } from '../constants.js';
import { raidCard, roleBar } from '../components/raid-card.js';
import { roleBarFull } from '../components/role-bar.js';
import { monthlyCalendar, weeklyCalendar } from '../components/calendar.js';
import { showConfirm } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { navigate } from '../router.js';
import { loadData } from '../app.js';
import { isAdminUser } from '../auth.js';

let _unsub = [];
let _container = null;

export function render(container, params) {
  _container = container;
  _unsub.forEach(u => u());
  _unsub = [];

  if (params?.id) {
    _renderRaidDetail(container, params.id);
  } else {
    _renderRaidList(container);
  }

  _unsub.push(subscribe('raids', () => {
    if (params?.id) _renderRaidDetail(container, params.id);
    else _renderRaidList(container);
  }));
}

export function unmount() {
  _unsub.forEach(u => u());
  _unsub = [];
  _container = null;
}

function _filteredRaids() {
  const raids = getState('raids') || [];
  const filter = getState('ui.raidSizeFilter');
  if (filter === 'all') return raids;
  return raids.filter(r => String(r.maxPlayers) === filter);
}

function _renderRaidList(container) {
  const raids = _filteredRaids();
  const calMode = getState('ui.raidCalMode') || 'list';
  const calDate = getState('ui.raidCalDate') || new Date();
  const user = getState('auth.user');
  const sizeFilter = getState('ui.raidSizeFilter');

  // Sort by date
  const sorted = [...raids].sort((a, b) => new Date(a.date) - new Date(b.date));

  let html = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--sp-4);flex-wrap:wrap;gap:var(--sp-2)">
    <h2 style="margin:0">Raids</h2>
    ${user ? `<button class="btn-primary" style="font-size:13px;padding:8px 18px" id="btn-create-raid">+ Raid erstellen</button>` : ''}
  </div>`;

  // Mode tabs + filter
  html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--sp-4);flex-wrap:wrap;gap:var(--sp-2)">
    <div class="segmented">
      <button class="seg-btn${calMode === 'list' ? ' active' : ''}" data-calmode="list">Liste</button>
      <button class="seg-btn${calMode === 'week' ? ' active' : ''}" data-calmode="week">Woche</button>
      <button class="seg-btn${calMode === 'month' ? ' active' : ''}" data-calmode="month">Monat</button>
    </div>
    <div class="raid-filter-bar">
      <button class="rf-btn${sizeFilter === 'all' ? ' active' : ''}" data-filter="all">Alle</button>
      <button class="rf-btn${sizeFilter === '10' ? ' active' : ''}" data-filter="10">10er</button>
      <button class="rf-btn${sizeFilter === '25' ? ' active' : ''}" data-filter="25">25er</button>
    </div>
  </div>`;

  if (calMode === 'list') {
    if (sorted.length) {
      sorted.forEach(r => { html += raidCard(r, { user }); });
    } else {
      html += '<div class="empty">Keine Raids geplant</div>';
    }
  } else if (calMode === 'week') {
    html += weeklyCalendar(calDate, raids);
  } else {
    html += monthlyCalendar(calDate, raids);
  }

  container.innerHTML = html;

  // Events
  container.querySelectorAll('[data-calmode]').forEach(btn => {
    btn.addEventListener('click', () => {
      update('ui.raidCalMode', btn.dataset.calmode);
      _renderRaidList(container);
    });
  });

  container.querySelectorAll('[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      update('ui.raidSizeFilter', btn.dataset.filter);
      _renderRaidList(container);
    });
  });

  container.querySelector('#btn-create-raid')?.addEventListener('click', () => _showCreateForm(container));

  // Discord button delegation
  container.querySelectorAll('.btn-discord').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const raidId = btn.dataset.raidId;
      btn.disabled = true;
      btn.textContent = 'Senden...';
      try {
        await api.post('/api/discord', { action: 'post', raidId });
        toast('Discord-Nachricht gesendet');
      } catch (err) {
        toast(err.message || 'Discord-Fehler');
      }
      btn.disabled = false;
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg> Discord`;
    });
  });

  // Lock/unlock button delegation
  container.querySelectorAll('.btn-raid-lock').forEach(btn => {
    btn.addEventListener('click', async () => {
      const raidId = btn.dataset.raidId;
      const action = btn.dataset.lockAction;
      if (action === 'lock') {
        showConfirm('Raid sperren', 'Der Raid wird <strong>gesperrt</strong> — Anmeldungen sind dann nicht mehr möglich. Soll der Raid gesperrt werden?', async () => {
          try {
            await api.post(RAIDS_API, { action: 'lock', raidId });
            toast('Raid gesperrt');
            await loadData();
          } catch (err) { toast('Fehler: ' + err.message); }
        });
      } else {
        try {
          await api.post(RAIDS_API, { action: 'unlock', raidId });
          toast('Raid entsperrt');
          await loadData();
        } catch (err) { toast('Fehler: ' + err.message); }
      }
    });
  });

  // Calendar navigation
  container.querySelectorAll('[data-action="cal-prev"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const d = new Date(calDate);
      if (calMode === 'week') d.setDate(d.getDate() - 7);
      else d.setMonth(d.getMonth() - 1);
      update('ui.raidCalDate', d);
      _renderRaidList(container);
    });
  });

  container.querySelectorAll('[data-action="cal-next"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const d = new Date(calDate);
      if (calMode === 'week') d.setDate(d.getDate() + 7);
      else d.setMonth(d.getMonth() + 1);
      update('ui.raidCalDate', d);
      _renderRaidList(container);
    });
  });
}

function _showCreateForm(container) {
  const form = getState('ui.raidForm');
  container.innerHTML = `<div class="card" style="padding:28px">
    <h2 style="margin-bottom:var(--sp-4)">Raid erstellen</h2>
    <div class="field">
      <span class="label">Instanz</span>
      <select class="input" id="rf-instance">
        <option value="">— Wählen —</option>
        ${TBC_RAIDS.map(r => `<option value="${h(r.n)}"${form.instance === r.n ? ' selected' : ''}>${h(r.n)} (${r.max})</option>`).join('')}
      </select>
    </div>
    <div class="field">
      <span class="label">Datum</span>
      <input class="input" type="date" id="rf-date" value="${form.date}">
    </div>
    <div class="field">
      <span class="label">Uhrzeit</span>
      <input class="input" type="time" id="rf-time" value="${form.time || '20:00'}">
    </div>
    <div class="field">
      <span class="label">Max. Spieler</span>
      <input class="input" type="number" id="rf-max" value="${form.maxPlayers}" min="1" max="40">
    </div>
    <div class="field">
      <span class="label">Beschreibung (optional)</span>
      <input class="input" type="text" id="rf-desc" value="${h(form.description || '')}" placeholder="z.B. Farm-Run, neue Bosse...">
    </div>
    <div class="field">
      <span class="label">Anmeldefrist (optional)</span>
      <input class="input" type="datetime-local" id="rf-deadline" value="${form.deadline || ''}">
    </div>
    <div class="btn-row">
      <button class="btn-primary" id="rf-submit">Erstellen</button>
      <button class="btn-secondary" id="rf-cancel">Abbrechen</button>
    </div>
  </div>`;

  // Auto-set maxPlayers from instance
  container.querySelector('#rf-instance').addEventListener('change', function () {
    const inst = TBC_RAIDS.find(r => r.n === this.value);
    if (inst) container.querySelector('#rf-max').value = inst.max;
  });

  container.querySelector('#rf-submit').addEventListener('click', async () => {
    const data = {
      action: 'create',
      instance: container.querySelector('#rf-instance').value,
      date: container.querySelector('#rf-date').value,
      time: container.querySelector('#rf-time').value,
      maxPlayers: parseInt(container.querySelector('#rf-max').value) || 25,
      description: container.querySelector('#rf-desc').value,
      deadline: container.querySelector('#rf-deadline').value || undefined,
    };
    if (!data.instance || !data.date) { toast('Instanz und Datum erforderlich'); return; }
    try {
      await api.post(RAIDS_API, data);
      toast('Raid erstellt \u2713');
      await loadData();
      _renderRaidList(container);
    } catch (e) { toast('Fehler: ' + e.message); }
  });

  container.querySelector('#rf-cancel').addEventListener('click', () => _renderRaidList(container));
}

function _renderRaidDetail(container, raidId) {
  const raids = getState('raids') || [];
  const raid = raids.find(r => r.id === raidId);
  if (!raid) {
    container.innerHTML = '<div class="empty">Raid nicht gefunden</div>';
    return;
  }

  const user = getState('auth.user');
  const signups = raid.signups || [];
  const isCreator = user && raid.createdBy === user.userId;
  const isAdmin = isAdminUser();
  const canManage = isCreator || isAdmin;
  const isPast = new Date(raid.date + 'T' + (raid.time || '20:00')) < new Date();

  // Group signups by role
  const byRole = {};
  ROLES.forEach(r => { byRole[r] = []; });
  signups.forEach(s => {
    const role = s.role || 'DPS';
    if (byRole[role]) byRole[role].push(s);
    else byRole['DPS'].push(s);
  });

  const roleCounts = { Tank: byRole.Tank.length, Heiler: byRole.Heiler.length, DPS: byRole.DPS.length };

  let html = `<div class="raid-detail">
    <button class="btn-secondary" style="margin-bottom:var(--sp-4);font-size:12px;padding:6px 14px" id="btn-back-raids">\u2190 Zurück</button>
    <div class="card">
      <div class="raid-card-header">
        <span class="raid-inst">${h(raid.instance)}</span>
        ${raid.locked ? '<span class="raid-locked" title="Gesperrt"><span class="material-symbols-outlined" style="font-size:16px;vertical-align:middle">lock</span></span>' : ''}
      </div>
      <div class="raid-card-meta">
        <span>${formatDate(raid.date)} ${raid.time || ''}</span>
        <span>${signups.length}/${raid.maxPlayers} Anmeldungen</span>
        ${raid.createdByName ? `<span>von ${h(raid.createdByName)}</span>` : ''}
      </div>
      ${raid.description ? `<div class="raid-desc">\u201E${h(raid.description)}\u201C</div>` : ''}
      ${raid.deadline ? `<div style="font-size:var(--text-xs);color:var(--color-text-muted);margin-top:var(--sp-2)">Frist: ${new Date(raid.deadline).toLocaleString('de-DE')}</div>` : ''}
    </div>

    <div class="card">
      <div class="card-title">Rollenzusammensetzung</div>
      ${roleBarFull(roleCounts)}
    </div>

    <div class="card">
      <div class="card-title">Anmeldungen (${signups.length})</div>
      ${ROLES.map(r => {
        const group = byRole[r];
        if (!group.length) return '';
        return `<div class="raid-signups-group">
          <div class="raid-signups-group-title" style="color:${ROLE_COLORS[r]}">${ROLE_ICONS[r]} ${r} (${group.length})</div>
          ${group.map(s => _renderSignupRow(s, canManage, raid)).join('')}
        </div>`;
      }).join('')}
      ${signups.length === 0 ? '<div class="empty">Noch keine Anmeldungen</div>' : ''}
    </div>`;

  // Signup form (if logged in and not locked)
  if (user && !raid.locked && !isPast) {
    const mySignup = signups.find(s => s.userId === user.userId);
    if (!mySignup) {
      html += _renderSignupForm(raid);
    }
  }

  // Management actions
  if (canManage) {
    html += `<div class="raid-detail-actions">
      ${!raid.locked ? `<button class="btn-secondary" id="btn-lock-raid"><span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle">lock</span> Sperren</button>` : `<button class="btn-secondary" id="btn-unlock-raid"><span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle">lock_open</span> Entsperren</button>`}
      <button class="btn-danger" id="btn-delete-raid">\u2715 Löschen</button>
    </div>`;
  }

  html += '</div>';
  container.innerHTML = html;

  // Events
  container.querySelector('#btn-back-raids')?.addEventListener('click', () => navigate('/raids'));

  container.querySelector('#btn-lock-raid')?.addEventListener('click', async () => {
    try {
      await api.post(RAIDS_API, { action: 'update', id: raid.id, locked: true });
      toast('Raid gesperrt');
      await loadData();
    } catch (e) { toast('Fehler: ' + e.message); }
  });

  container.querySelector('#btn-unlock-raid')?.addEventListener('click', async () => {
    try {
      await api.post(RAIDS_API, { action: 'update', id: raid.id, locked: false });
      toast('Raid entsperrt');
      await loadData();
    } catch (e) { toast('Fehler: ' + e.message); }
  });

  container.querySelector('#btn-delete-raid')?.addEventListener('click', () => {
    showConfirm('Raid löschen', `<strong>${h(raid.instance)}</strong> am ${formatDate(raid.date)} wirklich löschen?`, async () => {
      try {
        await api.del(RAIDS_API + '?id=' + raid.id);
        toast('Raid gelöscht');
        await loadData();
        navigate('/raids');
      } catch (e) { toast('Fehler: ' + e.message); }
    });
  });

  // Signup form submit
  container.querySelector('#btn-signup')?.addEventListener('click', async () => {
    const entries = getState('entries') || [];
    const charSel = container.querySelector('#signup-char');
    const specSel = container.querySelector('#signup-spec');
    const noteSel = container.querySelector('#signup-note');
    const statusSel = container.querySelector('#signup-status');
    if (!charSel?.value) { toast('Charakter wählen'); return; }
    const entry = entries.find(e => e.id === charSel.value);
    if (!entry) return;
    const specName = specSel?.value || '';
    const role = specName ? (await import('../utils.js')).specRole(entry.className, specName) : (entry.roles?.[0] || 'DPS');
    try {
      await api.post(RAIDS_API, {
        action: 'signup',
        id: raid.id,
        charName: entry.charName,
        className: entry.className,
        role,
        offeredSpecs: entry.specs || [],
        assignedSpec: specName,
        status: statusSel?.value || 'accepted',
        note: noteSel?.value || '',
      });
      toast('Angemeldet \u2713');
      await loadData();
    } catch (e) { toast('Fehler: ' + e.message); }
  });

  // Signup action buttons
  container.querySelectorAll('[data-signup-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const action = btn.dataset.signupAction;
      const userId = btn.dataset.userId;
      try {
        await api.post(RAIDS_API, { action, id: raid.id, targetUserId: userId });
        toast('Aktualisiert');
        await loadData();
      } catch (e) { toast('Fehler: ' + e.message); }
    });
  });
}

function _renderSignupRow(s, canManage, raid) {
  const statusCls = `signup-${s.status || 'accepted'}`;
  const statusLabel = { accepted: '\u2713', tentative: '?', declined: '\u2715', benched: 'Bank', confirmed: '\u2713\u2713' }[s.status] || s.status;
  return `<div class="raid-signup-row">
    <span class="raid-signup-name" style="color:${cc(s.className)}">
      <img class="wow-ico-sm" src="${clsIcon(s.className)}" alt="" loading="lazy">
      ${h(s.charName)}
      ${s.assignedSpec ? `<img class="wow-ico-sm" src="${specIcon(s.className, s.assignedSpec)}" alt="" loading="lazy" style="margin-left:4px">` : ''}
    </span>
    <span class="raid-signup-status ${statusCls}">${statusLabel}</span>
    ${s.note ? `<span style="font-size:11px;color:var(--color-text-muted);font-style:italic">${h(s.note)}</span>` : ''}
    ${canManage ? `<div class="raid-signup-actions">
      ${s.status !== 'confirmed' ? `<button data-signup-action="confirm-signup" data-user-id="${s.userId}" title="Bestätigen">\u2713</button>` : ''}
      ${s.status !== 'benched' ? `<button data-signup-action="bench-signup" data-user-id="${s.userId}" title="Auf die Bank">B</button>` : ''}
      <button data-signup-action="remove-signup" data-user-id="${s.userId}" title="Entfernen">\u2715</button>
    </div>` : ''}
  </div>`;
}

function _renderSignupForm(raid) {
  const entries = getState('entries') || [];
  const user = getState('auth.user');
  const myEntries = entries.filter(e => e.userId === user?.userId);

  if (!myEntries.length) {
    return `<div class="card"><div class="empty">Erstelle zuerst einen <a href="#/form" style="color:var(--color-accent)">Eintrag</a>, um dich anzumelden.</div></div>`;
  }

  return `<div class="card signup-form">
    <div class="card-title">Anmelden</div>
    <div class="field">
      <span class="label">Charakter</span>
      <select class="input" id="signup-char">
        ${myEntries.map(e => `<option value="${e.id}">${h(e.charName)} (${h(e.className)})</option>`).join('')}
      </select>
    </div>
    <div class="field">
      <span class="label">Status</span>
      <select class="input" id="signup-status">
        <option value="accepted">Zugesagt</option>
        <option value="tentative">Vielleicht</option>
      </select>
    </div>
    <div class="field">
      <span class="label">Anmerkung (optional)</span>
      <input class="input" type="text" id="signup-note" placeholder="z.B. komme 10 Min. später">
    </div>
    <button class="btn-primary" id="btn-signup">Anmelden</button>
  </div>`;
}
