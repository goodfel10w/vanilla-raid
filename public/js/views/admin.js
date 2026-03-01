// ── Admin View ──

import { getState, update, subscribe } from '../state.js';
import { api, ADMIN_API, DKP_API } from '../api.js';
import { h, cc, timeAgo, clsIcon } from '../utils.js';
import { CLS, ROLES, ROLE_COLORS, ROLE_ICONS } from '../constants.js';
import { showModal, showConfirm } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { isAdminUser, doBnetLogin } from '../auth.js';
import { BNET_ICON, DISCORD_ICON } from '../constants.js';
import { loadData } from '../app.js';
import { authApi } from '../api.js';
import { roleBarFull } from '../components/role-bar.js';

let _unsub = [];
let adminUsers = [];
let adminLoaded = false;

export function render(container) {
  _unsub.forEach(u => u());
  _unsub = [];

  if (!isAdminUser()) {
    const user = getState('auth.user');
    if (!user) {
      container.innerHTML = `<div style="text-align:center;padding:var(--sp-12) var(--sp-5)">
        <div style="color:var(--color-text-muted);font-size:var(--text-sm);margin-bottom:var(--sp-4)">Bitte melde dich an.</div>
        <button class="btn-bnet" data-action="bnet-login">${BNET_ICON} Mit Battle.net anmelden</button>
      </div>`;
    } else {
      container.innerHTML = '<div class="empty">Kein Zugriff — nur für Admins.</div>';
    }
    return;
  }

  if (!adminLoaded) {
    _loadAdminData().then(() => _renderAdmin(container));
  } else {
    _renderAdmin(container);
  }

  _unsub.push(subscribe('auth.user', () => _renderAdmin(container)));
  _unsub.push(subscribe('entries', () => _renderAdmin(container)));
}

export function unmount() {
  _unsub.forEach(u => u());
  _unsub = [];
}

async function _loadAdminData() {
  try {
    const data = await api.get(ADMIN_API);
    adminUsers = Array.isArray(data) ? data : [];
    adminLoaded = true;
  } catch (e) {
    console.error('Admin load error:', e);
    adminUsers = [];
  }
}

function _renderAdmin(container) {
  if (!isAdminUser()) {
    container.innerHTML = '<div class="empty">Kein Zugriff</div>';
    return;
  }

  const entries = getState('entries') || [];
  const raids = getState('raids') || [];
  const adminView = getState('ui.adminView') || 'overview';
  const dkpConfig = getState('dkp.config') || {};
  const roles = dkpConfig.roles || {};

  let html = `<h2 style="margin-bottom:var(--sp-4)">Admin</h2>`;

  // Sub-tabs
  html += `<div class="segmented" style="margin-bottom:var(--sp-4)">
    <button class="seg-btn${adminView === 'overview' ? ' active' : ''}" data-adminview="overview">Übersicht</button>
    <button class="seg-btn${adminView === 'users' ? ' active' : ''}" data-adminview="users">Benutzer</button>
    <button class="seg-btn${adminView === 'entries' ? ' active' : ''}" data-adminview="entries">Einträge</button>
    <button class="seg-btn${adminView === 'management' ? ' active' : ''}" data-adminview="management">Verwaltung</button>
  </div>`;

  if (adminView === 'overview') {
    html += _renderOverview(entries, raids, roles);
  } else if (adminView === 'users') {
    html += _renderUsers(roles);
  } else if (adminView === 'entries') {
    html += _renderEntries(entries);
  } else if (adminView === 'management') {
    html += _renderManagement(entries);
  }

  container.innerHTML = html;

  // Tab events
  container.querySelectorAll('[data-adminview]').forEach(btn => {
    btn.addEventListener('click', () => {
      update('ui.adminView', btn.dataset.adminview);
      _renderAdmin(container);
    });
  });

  // Action events
  _attachEvents(container, entries);
}

function _renderOverview(entries, raids, roles) {
  // Role counts
  const roleCounts = { Tank: 0, Heiler: 0, DPS: 0 };
  entries.forEach(e => {
    (e.roles || []).forEach(r => {
      if (roleCounts[r] !== undefined) roleCounts[r]++;
    });
  });

  // Class counts
  const classCounts = {};
  entries.forEach(e => {
    if (e.className) classCounts[e.className] = (classCounts[e.className] || 0) + 1;
  });
  const classEntries = Object.entries(classCounts).sort((a, b) => b[1] - a[1]);
  const maxClassCount = classEntries.length ? classEntries[0][1] : 1;

  // Raid readiness
  const now = new Date();
  const upcoming = raids.filter(r => new Date(r.date + 'T' + (r.time || '20:00')) >= now);

  let html = `<div class="admin-stat-grid">
    <div class="admin-stat-card card">
      <div class="admin-stat-val">${adminUsers.length}</div>
      <div class="admin-stat-lbl">Benutzer</div>
    </div>
    <div class="admin-stat-card card">
      <div class="admin-stat-val">${entries.length}</div>
      <div class="admin-stat-lbl">Einträge</div>
    </div>
    <div class="admin-stat-card card">
      <div class="admin-stat-val" style="color:var(--color-role-tank)">${roleCounts.Tank}</div>
      <div class="admin-stat-lbl">Tanks</div>
    </div>
    <div class="admin-stat-card card">
      <div class="admin-stat-val" style="color:var(--color-role-healer)">${roleCounts.Heiler}</div>
      <div class="admin-stat-lbl">Heiler</div>
    </div>
    <div class="admin-stat-card card">
      <div class="admin-stat-val" style="color:var(--color-role-dps)">${roleCounts.DPS}</div>
      <div class="admin-stat-lbl">DPS</div>
    </div>
  </div>`;

  // Class bars
  if (classEntries.length) {
    html += `<div class="card">
      <div class="card-title">Klassenverteilung</div>
      <div class="admin-class-dist">
        ${classEntries.map(([cls, count]) => {
          const pct = (count / maxClassCount) * 100;
          return `<div class="class-dist-row">
            <span class="class-dist-label" style="color:${cc(cls)}">${h(cls)}</span>
            <div class="class-dist-track">
              <div class="class-dist-bar" style="width:${pct}%;background:${cc(cls)}"></div>
            </div>
            <span class="class-dist-count">${count}</span>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }

  // Raid readiness gauges
  if (upcoming.length) {
    html += `<div class="card">
      <div class="card-title">Raid-Bereitschaft</div>
      ${upcoming.slice(0, 3).map(r => {
        const su = (r.signups || []).filter(s => s.status !== 'declined');
        const rc = { Tank: 0, Heiler: 0, DPS: 0 };
        su.forEach(s => { const role = s.role || 'DPS'; if (rc[role] !== undefined) rc[role]++; });
        const targets = r.maxPlayers <= 10 ? { Tank: 2, Heiler: 3, DPS: 5 } : { Tank: 2, Heiler: 5, DPS: 18 };
        return `<div style="margin-bottom:var(--sp-4)">
          <div style="font-weight:600;color:var(--color-accent);margin-bottom:var(--sp-2)">${h(r.instance)} — ${su.length}/${r.maxPlayers}</div>
          ${roleBarFull(rc, targets)}
        </div>`;
      }).join('')}
    </div>`;
  }

  return html;
}

function _renderUsers(appRoles) {
  const roleEntries = Object.entries(appRoles);
  let html = `<div class="card">
    <div class="card-title">Benutzer (${adminUsers.length})</div>
    <div class="admin-users">
      ${adminUsers.length ? adminUsers.map(u => {
        const uname = (u.username || u.battleTag || '?').toLowerCase().split('#')[0];
        const role = appRoles[uname] || appRoles[u.username || ''];
        const roleBadge = role === 'admin'
          ? '<span class="admin-role-badge admin-role-admin">Admin</span>'
          : role === 'officer'
          ? '<span class="admin-role-badge admin-role-officer">Offizier</span>'
          : '';
        return `<div class="admin-user-row">
          <span class="admin-user-name">${h(u.username || u.battleTag || '?')}${roleBadge}</span>
          <span class="admin-user-info">${u.discordUsername ? 'Discord: ' + h(u.discordUsername) : ''}</span>
          <span class="admin-user-info">${u.createdAt ? timeAgo(u.createdAt) : ''}</span>
          <div class="admin-user-actions">
            ${!role ? `<button class="btn-secondary admin-role-btn" data-username="${h(uname)}" data-role-action="officer" style="font-size:11px;padding:2px 8px">+ Offizier</button>` : ''}
            ${role ? `<button class="btn-danger admin-role-btn" data-username="${h(uname)}" data-role-action="remove" style="font-size:11px;padding:2px 8px">Rolle entfernen</button>` : ''}
          </div>
        </div>`;
      }).join('') : '<div class="empty">Keine Benutzer</div>'}
    </div>
  </div>`;

  // Add role form
  html += `<div class="card">
    <div class="card-title">Rolle vergeben</div>
    <div style="display:flex;gap:var(--sp-2);align-items:center;flex-wrap:wrap">
      <input class="input" type="text" id="admin-role-user" placeholder="Benutzername" style="flex:1;min-width:150px">
      <select class="input" id="admin-role-type" style="width:auto">
        <option value="officer">Offizier</option>
        <option value="admin">Admin</option>
      </select>
      <button class="btn-primary" id="admin-role-add" style="font-size:13px;padding:6px 14px">Hinzufügen</button>
    </div>
  </div>`;

  return html;
}

function _renderEntries(entries) {
  const sorted = [...entries].sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

  return `<div class="card">
    <div class="card-title">Einträge (${entries.length})</div>
    ${sorted.length ? `<div style="overflow-x:auto"><table class="admin-entries-table">
      <thead><tr>
        <th>Name</th>
        <th>Klasse</th>
        <th>Rollen</th>
        <th>Datum</th>
        <th></th>
      </tr></thead>
      <tbody>${sorted.map(e => `<tr>
        <td style="font-weight:600;color:${cc(e.className)}">
          <img class="wow-ico-sm" src="${clsIcon(e.className)}" alt="" loading="lazy" style="vertical-align:middle;margin-right:4px">
          ${h(e.charName)}
        </td>
        <td style="font-size:12px;color:var(--color-text-muted)">${h(e.className || '')}</td>
        <td style="font-size:12px">${(e.roles || []).map(r => `<span style="color:${ROLE_COLORS[r] || '#ccc'}">${r}</span>`).join(', ')}</td>
        <td style="font-size:11px;color:var(--color-text-muted)">${e.timestamp ? timeAgo(e.timestamp) : ''}</td>
        <td><button class="btn-danger admin-delete-entry" data-entry-id="${e.id}" style="font-size:11px;padding:2px 8px">\u2715</button></td>
      </tr>`).join('')}</tbody>
    </table></div>` : '<div class="empty">Keine Einträge</div>'}
  </div>`;
}

function _renderManagement(entries) {
  return `<div class="card">
    <div class="card-title">Discord-Emoji-Setup</div>
    <div style="font-size:var(--text-sm);color:var(--color-text-muted);margin-bottom:var(--sp-3)">
      Lade Klassenicons als Custom-Emojis in deinen Discord-Server hoch, um sie in Raid-Posts zu verwenden.
    </div>
    <div style="display:flex;gap:var(--sp-2);flex-wrap:wrap">
      ${CLS.map(c => `<span style="display:inline-flex;align-items:center;gap:4px;font-size:12px;color:${c.c}">
        <img src="https://cdn.jsdelivr.net/gh/orourkek/Wow-Icons@master/images/class/64/${c.i}.png" width="16" height="16" alt="">
        :${c.i}:
      </span>`).join('')}
    </div>
  </div>

  <div class="card">
    <div class="card-title">Gefahrenzone</div>
    <div class="admin-actions">
      <button class="btn-danger" id="admin-purge-users">Accounts zurücksetzen</button>
      <button class="btn-danger" id="admin-purge-entries">Alle ${entries.length} Einträge löschen</button>
    </div>
  </div>`;
}

function _attachEvents(container, entries) {
  // Purge users
  container.querySelector('#admin-purge-users')?.addEventListener('click', () => {
    showConfirm('Accounts zurücksetzen', 'Alle Accounts außer Admins werden gelöscht. Nutzer müssen sich neu anmelden.', async () => {
      try {
        const r = await authApi('purge-users');
        toast(`${r.deletedUsers} Accounts und ${r.deletedSessions} Sitzungen gelöscht`);
        adminLoaded = false;
        await _loadAdminData();
        _renderAdmin(container);
      } catch (e) { toast('Fehler: ' + e.message); }
    });
  });

  // Purge entries
  container.querySelector('#admin-purge-entries')?.addEventListener('click', () => {
    showConfirm('Alle Einträge löschen', `Alle <strong>${entries.length}</strong> Einträge werden unwiderruflich gelöscht.`, async () => {
      try {
        const user = getState('auth.user');
        const r = await fetch('/api/entries?all=true', {
          method: 'DELETE',
          headers: user?.token ? { Authorization: 'Bearer ' + user.token } : {},
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Fehler');
        toast(`${d.deleted} Einträge gelöscht`);
        await loadData();
      } catch (e) { toast('Fehler: ' + e.message); }
    });
  });

  // Delete individual entry
  container.querySelectorAll('.admin-delete-entry').forEach(btn => {
    btn.addEventListener('click', () => {
      const entryId = btn.dataset.entryId;
      const entry = entries.find(e => e.id === entryId);
      showConfirm('Eintrag löschen', `<strong>${h(entry?.charName || '')}</strong> wirklich löschen?`, async () => {
        try {
          const user = getState('auth.user');
          await fetch('/api/entries?id=' + entryId, {
            method: 'DELETE',
            headers: user?.token ? { Authorization: 'Bearer ' + user.token } : {},
          });
          toast('Eintrag gelöscht');
          await loadData();
        } catch (e) { toast('Fehler: ' + e.message); }
      });
    });
  });

  // Add role
  container.querySelector('#admin-role-add')?.addEventListener('click', async () => {
    const username = container.querySelector('#admin-role-user')?.value?.trim();
    const role = container.querySelector('#admin-role-type')?.value || 'officer';
    if (!username) { toast('Benutzername erforderlich'); return; }
    try {
      await api.post(DKP_API, { action: 'manage-roles', username: username.toLowerCase(), role });
      toast(`${username} als ${role === 'admin' ? 'Admin' : 'Offizier'} hinzugefügt`);
      await loadData();
    } catch (e) { toast('Fehler: ' + e.message); }
  });

  // Role action buttons (change/remove)
  container.querySelectorAll('.admin-role-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const username = btn.dataset.username;
      const action = btn.dataset.roleAction;
      if (action === 'remove') {
        try {
          await api.post(DKP_API, { action: 'manage-roles', username, role: null });
          toast(`Rolle von ${username} entfernt`);
          await loadData();
        } catch (e) { toast('Fehler: ' + e.message); }
      } else {
        try {
          await api.post(DKP_API, { action: 'manage-roles', username, role: action });
          toast(`${username} als Offizier gesetzt`);
          await loadData();
        } catch (e) { toast('Fehler: ' + e.message); }
      }
    });
  });
}
