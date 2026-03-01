// ── Hash-based SPA Router ──

import { update } from './state.js';

const _routes = new Map();
const _viewCache = new Map();
let _currentView = null;

/** Register a route */
export function route(path, loader) {
  _routes.set(path, loader);
}

/** Navigate to a path */
export function navigate(path) {
  if (window.location.hash !== '#' + path) {
    window.location.hash = path;
  } else {
    _handleRoute();
  }
}

/** Get current route path */
export function currentPath() {
  return window.location.hash.slice(1) || '/dashboard';
}

/** Extract params from route pattern */
function matchRoute(hash) {
  const path = hash.slice(1) || '/dashboard';
  // Try exact match first
  if (_routes.has(path)) return { route: path, params: {} };
  // Try pattern matching (e.g., /raids/:id, /dkp/player/:name)
  for (const [pattern] of _routes) {
    const patternParts = pattern.split('/');
    const pathParts = path.split('/');
    if (patternParts.length !== pathParts.length) continue;
    const params = {};
    let match = true;
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) {
        params[patternParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
      } else if (patternParts[i] !== pathParts[i]) {
        match = false;
        break;
      }
    }
    if (match) return { route: pattern, params };
  }
  return { route: '/dashboard', params: {} };
}

/** Get the view name from a route path */
export function viewFromPath(path) {
  const parts = path.split('/').filter(Boolean);
  return parts[0] || 'dashboard';
}

async function _handleRoute() {
  const { route: matchedRoute, params } = matchRoute(window.location.hash);
  const viewName = viewFromPath(matchedRoute);
  const loader = _routes.get(matchedRoute);
  if (!loader) return;

  update('ui.view', viewName);

  const mainEl = document.getElementById('app');
  if (!mainEl) return;

  try {
    // Load view module (cached after first load)
    if (!_viewCache.has(matchedRoute)) {
      const mod = await loader();
      _viewCache.set(matchedRoute, mod);
    }
    const mod = _viewCache.get(matchedRoute);

    // Transition
    const doSwap = () => {
      if (_currentView && typeof _currentView.unmount === 'function') {
        _currentView.unmount();
      }
      // Load view-specific CSS
      _loadViewCSS(viewName);
      // Render new view
      mainEl.innerHTML = '<div class="view-container" id="v-' + viewName + '" data-view="' + viewName + '" data-testid="view-' + viewName + '"></div>';
      const container = mainEl.querySelector('.view-container');
      if (typeof mod.render === 'function') {
        mod.render(container, params);
      } else if (typeof mod.default === 'function') {
        mod.default(container, params);
      }
      _currentView = mod;
      // Focus management: move focus to main content for keyboard/screen reader users
      mainEl.setAttribute('tabindex', '-1');
      mainEl.focus({ preventScroll: true });
      mainEl.removeAttribute('tabindex');
    };

    if (document.startViewTransition) {
      document.startViewTransition(doSwap);
    } else {
      doSwap();
    }
  } catch (e) {
    console.error('Route error:', e);
    mainEl.innerHTML = '<div class="view-container"><div class="empty">Fehler beim Laden der Ansicht.</div></div>';
  }

  // Update nav active states
  document.querySelectorAll('.nav-item, .bottom-nav-item, .more-sheet-item').forEach(el => {
    const href = el.getAttribute('href') || el.dataset.href;
    if (href) {
      const isActive = href === '#/' + viewName || (href === '#/dashboard' && viewName === 'dashboard');
      el.setAttribute('aria-current', isActive ? 'page' : 'false');
    }
  });
}

/** Lazy-load view CSS */
const _loadedCSS = new Set();
function _loadViewCSS(viewName) {
  if (_loadedCSS.has(viewName)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `/styles/views/${viewName}.css`;
  link.onerror = () => {}; // Silently ignore missing CSS
  document.head.appendChild(link);
  _loadedCSS.add(viewName);
}

/** Initialize router */
export function initRouter() {
  window.addEventListener('hashchange', _handleRoute);
  // Set default route if none
  if (!window.location.hash || window.location.hash === '#') {
    window.location.hash = '#/dashboard';
  } else {
    _handleRoute();
  }
}
