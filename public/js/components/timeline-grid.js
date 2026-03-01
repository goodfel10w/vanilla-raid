// ── Timeline Grid Component ──

import { DAYS, DAY_SHORT, SLOTS, HOUR_LABELS } from '../constants.js';
import { getState, update } from '../state.js';

/**
 * Render the availability timeline grid.
 * @param {Object} avail - Availability map
 * @returns {string} HTML
 */
export function timelineGrid(avail) {
  let gridRows = '';
  DAYS.forEach(d => {
    gridRows += `<tr><td class="tl-dl">${DAY_SHORT[d]}</td>`;
    SLOTS.forEach((s, i) => {
      const k = d + '_' + s;
      const v = avail[k];
      let cls = 'tl-cell';
      if (i % 4 === 0) cls += ' tl-hstart';
      if (v === 'yes') cls += ' on';
      else if (v === 'tentative') cls += ' tent';
      gridRows += `<td class="${cls}" data-k="${k}"></td>`;
    });
    gridRows += '</tr>';
  });

  return `<div class="tl-wrap">
    <table class="tl-table">
      <thead><tr><th></th>${HOUR_LABELS.map(hl => `<th colspan="4">${hl}</th>`).join('')}</tr></thead>
      <tbody>${gridRows}</tbody>
    </table>
  </div>`;
}

/**
 * Attach drag-to-paint handlers to a container.
 * @param {HTMLElement} container - Container with timeline cells
 * @param {Object} avail - Mutable availability map (form.avail)
 * @param {Function} [onChange] - Called when availability changes
 */
export function attachTimelinePaint(container, avail, onChange) {
  let painting = false;
  let paintState = null;

  function applyPaint(k, cell) {
    if (paintState === null) delete avail[k];
    else avail[k] = paintState;
    if (cell) {
      cell.classList.remove('on', 'tent');
      if (paintState === 'yes') cell.classList.add('on');
      else if (paintState === 'tentative') cell.classList.add('tent');
    }
  }

  container.addEventListener('mousedown', e => {
    const cell = e.target.closest('.tl-cell');
    if (!cell || !cell.dataset.k) return;
    e.preventDefault();
    painting = true;
    const k = cell.dataset.k;
    const cur = avail[k];
    if (!cur) paintState = 'yes';
    else if (cur === 'yes') paintState = 'tentative';
    else paintState = null;
    applyPaint(k, cell);
  });

  container.addEventListener('mousemove', e => {
    if (!painting) return;
    const cell = e.target.closest('.tl-cell');
    if (cell && cell.dataset.k) applyPaint(cell.dataset.k, cell);
  });

  document.addEventListener('mouseup', () => {
    if (painting) { painting = false; if (onChange) onChange(); }
  });

  // Touch support
  container.addEventListener('touchstart', e => {
    const cell = e.target.closest('.tl-cell');
    if (!cell || !cell.dataset.k) return;
    e.preventDefault();
    painting = true;
    const k = cell.dataset.k;
    const cur = avail[k];
    if (!cur) paintState = 'yes';
    else if (cur === 'yes') paintState = 'tentative';
    else paintState = null;
    applyPaint(k, cell);
  }, { passive: false });

  container.addEventListener('touchmove', e => {
    if (!painting) return;
    const t = e.touches[0];
    const el = document.elementFromPoint(t.clientX, t.clientY);
    if (el) {
      const cell = el.closest('.tl-cell');
      if (cell && cell.dataset.k) applyPaint(cell.dataset.k, cell);
    }
  }, { passive: true });

  document.addEventListener('touchend', () => {
    if (painting) { painting = false; if (onChange) onChange(); }
  });
}
