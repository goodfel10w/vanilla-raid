// ── Role Bar Component ──

import { ROLE_COLORS, ROLE_ICONS } from '../constants.js';

/**
 * Render a role composition progress bar.
 * @param {Object} counts - { Tank: n, Heiler: n, DPS: n }
 * @param {Object} [targets] - { Tank: n, Heiler: n, DPS: n }
 * @returns {string} HTML
 */
export function roleBarFull(counts, targets = { Tank: 2, Heiler: 5, DPS: 18 }) {
  return ['Tank', 'Heiler', 'DPS'].map(r => {
    const count = counts[r] || 0;
    const target = targets[r] || 1;
    const pct = Math.min(100, (count / target) * 100);
    const met = count >= target;
    return `<div class="role-fill-row">
      <span class="role-fill-label" style="color:${ROLE_COLORS[r]}">${ROLE_ICONS[r]} ${r}</span>
      <div class="role-fill-track">
        <div class="role-fill-bar" style="width:${pct}%;background:${ROLE_COLORS[r]}${met ? '' : '80'}"></div>
      </div>
      <span class="role-fill-count" style="color:${met ? ROLE_COLORS[r] : 'var(--color-text-muted)'}">${count}/${target}</span>
    </div>`;
  }).join('');
}
