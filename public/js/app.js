// ── App Entry Point ──

import { getState, update, subscribe } from './state.js';
import { api, ENTRIES_API, RAIDS_API, DKP_API } from './api.js';
import { initAuth, renderAuthBar, doBnetLogin, doDiscordLink, doLogout } from './auth.js';
import { route, initRouter, navigate } from './router.js';
import { renderSidebar, renderBottomNav } from './components/nav.js';
import { migrateLegacyAvail } from './utils.js';

// ── Register Routes ──
route('/dashboard', () => import('./views/dashboard.js'));
route('/form', () => import('./views/form.js'));
route('/raids', () => import('./views/raids.js'));
route('/raids/:id', () => import('./views/raids.js'));
route('/roster', () => import('./views/roster.js'));
route('/heatmap', () => import('./views/heatmap.js'));
route('/analytics', () => import('./views/analytics.js'));
route('/kara', () => import('./views/kara.js'));
route('/dkp', () => import('./views/dkp.js'));
route('/dkp/player/:name', () => import('./views/dkp.js'));
route('/admin', () => import('./views/admin.js'));

// ── Load Data ──
export async function loadData() {
  // Load entries
  try {
    const data = await api.get(ENTRIES_API);
    const entries = Array.isArray(data) ? data : [];
    entries.forEach(e => {
      if (e.availability) e.availability = migrateLegacyAvail(e.availability);
    });
    update('entries', entries);
  } catch (e) {
    console.error('Entries load error:', e);
    update('entries', []);
  }

  // Load raids
  try {
    const data = await api.get(RAIDS_API);
    update('raids', Array.isArray(data) ? data : []);
  } catch (e) {
    console.error('Raids load error:', e);
    update('raids', []);
  }

  // Load DKP
  try {
    const data = await api.get(DKP_API);
    update('dkp.balances', data.balances || []);
    update('dkp.transactions', data.transactions || []);
    if (data.config) {
      update('dkp.config', data.config);
      update('ui.dkpDecayPercent', data.config.defaultDecayPercent || 15);
    }
  } catch (e) {
    console.error('DKP load error:', e);
  }
}

// ── Auth Event Delegation ──
function setupAuthEvents() {
  document.addEventListener('click', e => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    switch (action) {
      case 'bnet-login': doBnetLogin(); break;
      case 'discord-link': doDiscordLink(); break;
      case 'logout': doLogout().then(() => {
        loadData();
        navigate('/dashboard');
      }); break;
    }
  });
}

// ── Init ──
async function init() {
  // Render navigation
  renderSidebar(document.getElementById('sidebar'));
  renderBottomNav(document.getElementById('bottomnav'));

  // Setup auth event delegation
  setupAuthEvents();

  // Init auth (handles OAuth callbacks, session restore)
  await initAuth();

  // Render auth bar
  const authBarEl = document.getElementById('auth-bar');
  if (authBarEl) renderAuthBar(authBarEl);

  // Add global counter element (updated when entries load)
  const counterEl = document.createElement('span');
  counterEl.id = 'counter';
  counterEl.className = 'sr-only';
  counterEl.setAttribute('aria-live', 'polite');
  document.body.appendChild(counterEl);
  subscribe('entries', () => {
    const entries = getState('entries') || [];
    counterEl.textContent = entries.length + ' Raider';
  });

  // Subscribe to auth changes to re-render auth bar
  subscribe('auth.user', () => {
    // Re-render nav first (creates fresh #auth-bar), then fill auth bar
    renderSidebar(document.getElementById('sidebar'));
    renderBottomNav(document.getElementById('bottomnav'));
    const authBarEl = document.getElementById('auth-bar');
    if (authBarEl) renderAuthBar(authBarEl);
  });

  // Load data
  await loadData();

  // Init router (triggers first view render)
  initRouter();
}

init().catch(e => console.error('Init error:', e));
