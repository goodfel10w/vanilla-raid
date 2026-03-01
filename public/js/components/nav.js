// ── Navigation Component ──

import { getState, update, subscribe } from '../state.js';
import { navigate, currentPath, viewFromPath } from '../router.js';
import { isAdminUser } from '../auth.js';

const NAV_GROUPS = [
  {
    label: 'Planen',
    items: [
      { view: 'dashboard', icon: '\u{1F3E0}', label: 'Dashboard', href: '#/dashboard' },
      { view: 'form', icon: '\u{1F4DD}', label: 'Eintragen', href: '#/form' },
      { view: 'raids', icon: '\u2694\uFE0F', label: 'Raids', href: '#/raids' },
    ],
  },
  {
    label: 'Auswerten',
    items: [
      { view: 'roster', icon: '\u{1F465}', label: 'Aufstellung', href: '#/roster' },
      { view: 'heatmap', icon: '\u{1F525}', label: 'Heatmap', href: '#/heatmap' },
      { view: 'analytics', icon: '\u{1F4CA}', label: 'Auswertung', href: '#/analytics' },
    ],
  },
  {
    label: 'Verwalten',
    items: [
      { view: 'kara', icon: '\u2699\uFE0F', label: 'Kara', href: '#/kara' },
      { view: 'dkp', icon: '\u{1F4B0}', label: 'DKP', href: '#/dkp' },
      { view: 'admin', icon: '\u{1F512}', label: 'Admin', href: '#/admin', adminOnly: true },
    ],
  },
];

// Bottom nav: 5 items + "Mehr"
const BOTTOM_NAV_ITEMS = [
  { view: 'dashboard', icon: '\u{1F3E0}', label: 'Dashboard', href: '#/dashboard' },
  { view: 'form', icon: '\u{1F4DD}', label: 'Eintragen', href: '#/form' },
  { view: 'raids', icon: '\u2694\uFE0F', label: 'Raids', href: '#/raids' },
  { view: 'dkp', icon: '\u{1F4B0}', label: 'DKP', href: '#/dkp' },
  { view: 'more', icon: '\u2022\u2022\u2022', label: 'Mehr', href: null },
];

export function renderSidebar(el) {
  if (!el) return;
  const isAdmin = isAdminUser();
  const expanded = getState('ui.sidebarExpanded');

  let html = `
    <div class="sidebar-header">
      <button class="sidebar-toggle" aria-label="Navigation ${expanded ? 'einklappen' : 'ausklappen'}" data-action="toggle-sidebar">
        <span style="font-size:20px">${expanded ? '\u2190' : '\u2192'}</span>
      </button>
      <span class="sidebar-logo">&lt;Vanilla&gt;</span>
    </div>`;

  NAV_GROUPS.forEach(group => {
    html += `<div class="sidebar-group"><div class="sidebar-group-label">${group.label}</div>`;
    group.items.forEach(item => {
      if (item.adminOnly && !isAdmin) return;
      html += `<a class="nav-item tab" href="${item.href}" data-view="${item.view}" data-v="${item.view}" aria-current="false">
        <span class="nav-icon">${item.icon}</span>
        <span class="nav-label">${item.label}</span>
      </a>`;
    });
    html += '</div>';
  });

  html += '<div class="sidebar-spacer"></div>';
  html += '<div id="auth-bar" style="padding: 0 var(--sp-4, 16px); margin-bottom: var(--sp-4, 16px);"></div>';

  el.innerHTML = html;
  el.classList.toggle('expanded', expanded);

  // Update active state
  _updateActiveNav();

  // Event: toggle sidebar
  el.querySelector('[data-action="toggle-sidebar"]')?.addEventListener('click', () => {
    const next = !getState('ui.sidebarExpanded');
    update('ui.sidebarExpanded', next);
    el.classList.toggle('expanded', next);
    el.querySelector('.sidebar-toggle').setAttribute('aria-label', `Navigation ${next ? 'einklappen' : 'ausklappen'}`);
    el.querySelector('.sidebar-toggle span').textContent = next ? '\u2190' : '\u2192';
  });

  // Event: nav clicks (let hash routing handle it)
  el.addEventListener('click', e => {
    const item = e.target.closest('.nav-item');
    if (!item) return;
    // Close sidebar on tablet
    if (window.innerWidth < 1024) {
      update('ui.sidebarExpanded', false);
      el.classList.remove('expanded');
    }
  });
}

export function renderBottomNav(el) {
  if (!el) return;

  let html = '<div class="bottom-nav-items">';
  BOTTOM_NAV_ITEMS.forEach(item => {
    if (item.view === 'more') {
      html += `<button class="bottom-nav-item" data-action="open-more" aria-label="Mehr anzeigen">
        <span class="bottom-nav-icon">${item.icon}</span>
        <span>${item.label}</span>
      </button>`;
    } else {
      html += `<a class="bottom-nav-item tab" href="${item.href}" data-view="${item.view}" data-v="${item.view}" aria-current="false">
        <span class="bottom-nav-icon">${item.icon}</span>
        <span>${item.label}</span>
      </a>`;
    }
  });
  html += '</div>';
  el.innerHTML = html;

  _updateActiveNav();

  // More button
  el.querySelector('[data-action="open-more"]')?.addEventListener('click', _openMoreSheet);
}

function _openMoreSheet() {
  const isAdmin = isAdminUser();
  const moreItems = [
    { view: 'roster', icon: '\u{1F465}', label: 'Aufstellung', href: '#/roster' },
    { view: 'heatmap', icon: '\u{1F525}', label: 'Heatmap', href: '#/heatmap' },
    { view: 'analytics', icon: '\u{1F4CA}', label: 'Auswertung', href: '#/analytics' },
    { view: 'kara', icon: '\u2699\uFE0F', label: 'Kara', href: '#/kara' },
  ];
  if (isAdmin) {
    moreItems.push({ view: 'admin', icon: '\u{1F512}', label: 'Admin', href: '#/admin' });
  }

  const sheet = document.createElement('div');
  sheet.className = 'more-sheet';
  sheet.innerHTML = `<div class="more-sheet-content">
    <div style="text-align:center;margin-bottom:var(--sp-4,16px)"><div style="width:40px;height:4px;background:rgba(255,255,255,.2);border-radius:2px;margin:0 auto"></div></div>
    ${moreItems.map(item => `<a class="more-sheet-item" href="${item.href}" data-view="${item.view}" data-v="${item.view}" aria-current="false">
      <span style="font-size:20px">${item.icon}</span>
      <span>${item.label}</span>
    </a>`).join('')}
  </div>`;

  document.body.appendChild(sheet);

  // Close on backdrop click
  sheet.addEventListener('click', e => {
    if (e.target === sheet) sheet.remove();
  });
  // Close on item click
  sheet.querySelectorAll('.more-sheet-item').forEach(item => {
    item.addEventListener('click', () => sheet.remove());
  });
  // Close on Escape
  const onKey = e => { if (e.key === 'Escape') { sheet.remove(); document.removeEventListener('keydown', onKey); } };
  document.addEventListener('keydown', onKey);
}

function _updateActiveNav() {
  const view = viewFromPath(currentPath());
  document.querySelectorAll('.nav-item, .bottom-nav-item, .more-sheet-item').forEach(el => {
    const itemView = el.dataset.view;
    if (itemView) {
      const isActive = itemView === view;
      el.setAttribute('aria-current', isActive ? 'page' : 'false');
      el.classList.toggle('on', isActive);
    }
  });
}

// Listen for hash changes to update active state
window.addEventListener('hashchange', _updateActiveNav);
