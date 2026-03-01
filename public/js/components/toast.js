// ── Toast Notifications ──

let _timeout = null;

/**
 * Show a toast notification.
 * @param {string} msg - Message to display
 * @param {string} [type] - Optional type: 'success', 'error', 'warning'
 */
export function toast(msg, type) {
  const el = document.getElementById('toast');
  if (!el) return;

  if (_timeout) clearTimeout(_timeout);

  el.textContent = msg;
  el.className = 'toast show';
  if (type) el.classList.add('toast-' + type);

  _timeout = setTimeout(() => {
    el.classList.remove('show');
    _timeout = null;
  }, 2500);
}

// Make globally available for modules that import it
window.toast = toast;
