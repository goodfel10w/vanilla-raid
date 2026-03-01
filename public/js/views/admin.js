// ── Admin View ──

import { getState, update, subscribe } from '../state.js';
import { api, ADMIN_API } from '../api.js';
import { h, timeAgo } from '../utils.js';
import { showConfirm } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { isAdminUser, doBnetLogin } from '../auth.js';
import { BNET_ICON } from '../constants.js';
import { loadData } from '../app.js';
import { authApi } from '../api.js';

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

  let html = `<h2 style="margin-bottom:var(--sp-4)">Admin</h2>`;

  // Stats
  html += `<div class="card">
    <div class="card-title">Übersicht</div>
    <div style="display:flex;gap:var(--sp-8);flex-wrap:wrap">
      <div><strong>${adminUsers.length}</strong> Benutzer</div>
      <div><strong>${entries.length}</strong> Einträge</div>
    </div>
  </div>`;

  // User list
  html += `<div class="card">
    <div class="card-title">Benutzer (${adminUsers.length})</div>
    <div class="admin-users">
      ${adminUsers.length ? adminUsers.map(u => `<div class="admin-user-row">
        <span class="admin-user-name">${h(u.username || u.battleTag || '?')}</span>
        <span class="admin-user-info">${u.discordUsername ? 'Discord: ' + h(u.discordUsername) : ''}</span>
        <span class="admin-user-info">${u.createdAt ? timeAgo(u.createdAt) : ''}</span>
      </div>`).join('') : '<div class="empty">Keine Benutzer</div>'}
    </div>
  </div>`;

  // Dangerous actions
  html += `<div class="card">
    <div class="card-title">Aktionen</div>
    <div class="admin-actions">
      <button class="btn-danger" id="admin-purge-users">Accounts zurücksetzen</button>
      <button class="btn-danger" id="admin-purge-entries">Alle Einträge löschen</button>
    </div>
  </div>`;

  container.innerHTML = html;

  // Events
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
}
