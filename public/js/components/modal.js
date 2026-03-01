// ── Modal Component (native <dialog>) ──

import { h } from '../utils.js';

/**
 * Show a modal dialog.
 * @param {Object} opts
 * @param {string} opts.title - Modal title (text, will be escaped)
 * @param {string} opts.body - Modal body (trusted HTML)
 * @param {Function} [opts.onConfirm] - Confirm callback
 * @param {string} [opts.confirmText] - Confirm button text
 * @param {string} [opts.cancelText] - Cancel button text
 * @param {string} [opts.confirmClass] - CSS class for confirm button
 * @returns {HTMLDialogElement}
 */
export function showModal({ title, body, onConfirm, confirmText = 'Bestätigen', cancelText = 'Abbrechen', confirmClass = 'btn-primary btn-danger-action' }) {
  const dialog = document.createElement('dialog');
  dialog.className = 'modal-dialog modal-bg';
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'modal-title');
  dialog.innerHTML = `
    <div class="modal">
      <div class="modal-title" id="modal-title"></div>
      <div class="modal-msg">${body}</div>
      <div class="modal-btns">
        <button class="modal-cancel btn-secondary">${h(cancelText)}</button>
        ${onConfirm ? `<button class="modal-confirm ${confirmClass}">${h(confirmText)}</button>` : ''}
      </div>
    </div>`;

  dialog.querySelector('.modal-title').textContent = title;
  document.body.appendChild(dialog);
  dialog.showModal();

  const previouslyFocused = document.activeElement;
  const close = () => { dialog.close(); dialog.remove(); if (previouslyFocused) previouslyFocused.focus(); };
  dialog.querySelector('.modal-cancel').addEventListener('click', close);
  if (onConfirm) {
    dialog.querySelector('.modal-confirm').addEventListener('click', () => { onConfirm(); close(); });
    dialog.querySelector('.modal-confirm').focus();
  } else {
    dialog.querySelector('.modal-cancel').focus();
  }
  dialog.addEventListener('click', e => { if (e.target === dialog) close(); });
  dialog.addEventListener('cancel', e => { e.preventDefault(); close(); });

  return dialog;
}

/**
 * Show a simple confirmation dialog.
 * @param {string} title
 * @param {string} msg - trusted HTML
 * @param {Function} onConfirm
 */
export function showConfirm(title, msg, onConfirm) {
  return showModal({ title, body: msg, onConfirm });
}

// Legacy compat: expose showModal globally for inline handlers
window.showModal = function (title, msg, onConfirm) {
  return showConfirm(title, msg, onConfirm);
};
