// ── Auth Module ──

import { getState, update } from './state.js';
import { authApi, BNET_CHARS_API, api } from './api.js';
import { toast } from './components/toast.js';
import { BNET_ICON } from './constants.js';
import { h } from './utils.js';

function applyDiscordInfo(target, res) {
  target.discordLinked = res.discordLinked || false;
  target.discordUsername = res.discordUsername || null;
  target.discordGuildMember = res.discordGuildMember || false;
}

export async function loadBnetCharacters() {
  const user = getState('auth.user');
  if (!user?.token) return;
  try {
    const r = await fetch(BNET_CHARS_API, { headers: { Authorization: 'Bearer ' + user.token } });
    if (r.ok) {
      const data = await r.json();
      update('auth.bnetCharacters', data.characters || []);
    }
  } catch (e) {
    console.error('Character load error:', e);
  }
}

export async function initAuth() {
  const hashParams = new URLSearchParams(window.location.hash.slice(1));
  const queryParams = new URLSearchParams(window.location.search);
  const bnetToken = hashParams.get('bnet_token') || queryParams.get('bnet_token');
  const authError = queryParams.get('auth_error');
  const discordLinked = hashParams.get('discord_linked');
  const discordError = queryParams.get('discord_error');

  if (bnetToken) {
    window.history.replaceState({}, '', window.location.pathname);
    const user = { token: bnetToken, username: '...', userId: '' };
    update('auth.user', user);
    localStorage.setItem('raid-auth', JSON.stringify(user));
    try {
      const res = await authApi('validate');
      const validated = { token: bnetToken, username: res.username, userId: res.userId, isAdmin: res.isAdmin || false };
      applyDiscordInfo(validated, res);
      update('auth.user', validated);
      localStorage.setItem('raid-auth', JSON.stringify(validated));
      toast('Angemeldet als ' + res.username);
      await loadBnetCharacters();
    } catch (e) {
      update('auth.user', null);
      localStorage.removeItem('raid-auth');
      toast('Anmeldung fehlgeschlagen');
    }
    return;
  }

  if (discordLinked) {
    window.history.replaceState({}, '', window.location.pathname);
    const stored = localStorage.getItem('raid-auth');
    if (stored) {
      try {
        const data = JSON.parse(stored);
        update('auth.user', data);
        const res = await authApi('validate');
        const validated = { ...data, username: res.username, userId: res.userId, isAdmin: res.isAdmin || false };
        applyDiscordInfo(validated, res);
        update('auth.user', validated);
        localStorage.setItem('raid-auth', JSON.stringify(validated));
        if (validated.discordGuildMember) {
          toast('Discord verknüpft — Gildenmitglied bestätigt \u2713');
        } else if (validated.discordLinked) {
          toast('Discord verknüpft — aber nicht auf dem Gilden-Discord');
        }
      } catch (e) {
        update('auth.user', null);
        localStorage.removeItem('raid-auth');
      }
    }
    return;
  }

  if (discordError) {
    window.history.replaceState({}, '', window.location.pathname);
    toast('Discord-Verknüpfung fehlgeschlagen');
  }
  if (authError) {
    window.history.replaceState({}, '', window.location.pathname);
    toast('Battle.net-Anmeldung fehlgeschlagen');
  }

  const stored = localStorage.getItem('raid-auth');
  if (stored) {
    try {
      const data = JSON.parse(stored);
      update('auth.user', data);
      const res = await authApi('validate');
      const validated = { ...data, username: res.username, userId: res.userId, isAdmin: res.isAdmin || false };
      applyDiscordInfo(validated, res);
      update('auth.user', validated);
      localStorage.setItem('raid-auth', JSON.stringify(validated));
      await loadBnetCharacters();
    } catch (e) {
      update('auth.user', null);
      localStorage.removeItem('raid-auth');
    }
  }
}

export async function doBnetLogin() {
  try {
    const res = await authApi('bnet-login');
    if (res.url) window.location.href = res.url;
  } catch (e) {
    toast('Login-Fehler: ' + e.message);
  }
}

export async function doDiscordLink() {
  try {
    const res = await authApi('discord-link');
    if (res.url) window.location.href = res.url;
  } catch (e) {
    toast('Discord-Fehler: ' + e.message);
  }
}

export async function doDiscordUnlink() {
  try {
    await authApi('discord-unlink');
    const user = getState('auth.user');
    if (user) {
      const updated = { ...user, discordLinked: false, discordUsername: null, discordGuildMember: false };
      update('auth.user', updated);
      localStorage.setItem('raid-auth', JSON.stringify(updated));
    }
    toast('Discord-Verknüpfung aufgehoben');
  } catch (e) {
    toast('Fehler: ' + e.message);
  }
}

export async function doLogout() {
  try { await authApi('logout'); } catch (e) { /* ignore */ }
  update('auth.user', null);
  update('auth.bnetCharacters', []);
  localStorage.removeItem('raid-auth');
  toast('Abgemeldet');
}

export function isAdminUser() {
  return getState('auth.user')?.isAdmin === true;
}

export function isOfficerUser() {
  const user = getState('auth.user');
  if (!user) return false;
  const config = getState('dkp.config');
  if (!config?.roles) return false;
  const username = user.username?.toLowerCase()?.split('#')[0];
  return Object.entries(config.roles).some(([u, r]) =>
    u.toLowerCase() === username && (r === 'officer' || r === 'admin')
  );
}

/** Render auth bar HTML */
export function renderAuthBar(container) {
  const user = getState('auth.user');
  if (!container) return;
  if (user) {
    const roleBadge = isAdminUser()
      ? ' <span class="admin-badge">Admin</span>'
      : isOfficerUser()
      ? ' <span class="admin-badge" style="background:#6495ed">Offizier</span>'
      : '';
    let dcBadge = '';
    if (user.discordLinked && user.discordGuildMember) {
      dcBadge = ` <span class="dc-verified">${dcIco(12)} ${h(user.discordUsername)}</span>`;
    } else if (user.discordLinked) {
      dcBadge = ` <span class="dc-unverified" title="Nicht auf dem Gilden-Discord">${dcIco(12)} Kein Gildenmitglied</span>`;
    } else {
      dcBadge = ` <button class="btn-dc-link" data-action="discord-link">${dcIco(14)} Discord verknüpfen</button>`;
    }
    container.innerHTML = `<div class="auth-bar" data-testid="auth-bar">Eingeloggt als <span class="auth-user">${h(user.username)}</span>${roleBadge}${dcBadge} <button class="btn-logout" data-action="logout">Abmelden</button></div>`;
  } else {
    container.innerHTML = `<div class="auth-bar" data-testid="auth-bar"><button class="btn-bnet" data-action="bnet-login">${BNET_ICON} Mit Battle.net anmelden</button></div>`;
  }
}

function dcIco(size) {
  return `<svg class="dc-ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>`;
}
