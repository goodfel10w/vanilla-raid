// ── Player Badge Component ──

import { h, cc, clsIcon, specIcon, specRole } from '../utils.js';
import { ROLE_ICONS, ROLE_COLORS } from '../constants.js';

/**
 * Render a player name with class icon and spec badges.
 * @param {Object} entry - Entry data
 * @param {Object} [opts]
 * @returns {string} HTML
 */
export function playerBadge(entry, opts = {}) {
  const color = cc(entry.className);
  const icon = clsIcon(entry.className);
  const name = entry.charName;
  const specs = entry.specs || [];
  const roles = entry.roles || [];

  let specHtml = '';
  if (specs.length) {
    specHtml = specs.map(s => {
      const r = specRole(entry.className, s);
      const sIcon = specIcon(entry.className, s);
      return `<span class="rbadge" style="background:${ROLE_COLORS[r]}18;color:${ROLE_COLORS[r]}">
        ${sIcon ? `<img class="wow-ico-sm" src="${sIcon}" alt="" loading="lazy">` : ROLE_ICONS[r]} ${s}
      </span>`;
    }).join('');
  } else if (roles.length) {
    specHtml = roles.map(r => `<span class="rbadge" style="background:${ROLE_COLORS[r]}18;color:${ROLE_COLORS[r]}">${ROLE_ICONS[r]} ${r}</span>`).join('');
  }

  return `<div class="player-badge" style="color:${color}">
    ${icon ? `<img class="wow-ico-sm" src="${icon}" alt="" loading="lazy">` : ''}
    <span class="e-name">${h(name)}</span>
    ${specHtml ? `<div class="e-roles">${specHtml}</div>` : ''}
  </div>`;
}
