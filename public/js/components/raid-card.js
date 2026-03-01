// ── Raid Card Component ──

import { h, formatDate } from '../utils.js';
import { isOfficerUser } from '../auth.js';

/**
 * Render a raid card.
 * @param {Object} raid - Raid data
 * @param {Object} [opts] - Options
 * @param {boolean} [opts.compact] - Compact mode for dashboard
 * @param {Object} [opts.user] - Current user (for action buttons)
 * @param {boolean} [opts.past] - Whether this is a past raid
 * @returns {string} HTML
 */
export function raidCard(raid, opts = {}) {
  const signups = raid.signups || [];
  const roles = countRoles(signups);
  const dateStr = formatDate(raid.date);
  const isPast = opts.past || false;

  // Status counts
  const confirmed = signups.filter(s => s.status === 'confirmed').length;
  const accepted = signups.filter(s => s.status === 'accepted').length;
  const tentative = signups.filter(s => s.status === 'tentative').length;

  // Deadline
  const deadlinePassed = raid.deadline && new Date(raid.deadline) < new Date();

  if (opts.compact) {
    return `<a class="raid-card raid-card-compact card" href="#/raids/${raid.id}" data-testid="raid-card">
      <div class="raid-card-header">
        <span class="raid-inst">${h(raid.instance)}</span>
        ${raid.locked ? '<span class="raid-locked" title="Gesperrt"><span class="material-symbols-outlined" style="font-size:16px;vertical-align:middle">lock</span></span>' : ''}
      </div>
      <div class="raid-card-meta">
        <span>${dateStr}</span>
        <span>${raid.time}</span>
        <span>${signups.length}/${raid.maxPlayers}</span>
        ${confirmed ? `<span style="color:var(--green-400)">\u2713\u2713${confirmed}</span>` : ''}
        ${accepted ? `<span style="color:var(--green-400)">\u2713${accepted}</span>` : ''}
        ${tentative ? `<span style="color:var(--yellow-400)">?${tentative}</span>` : ''}
      </div>
      ${roleBar(roles, raid.maxPlayers)}
      ${deadlinePassed ? '<div style="font-size:10px;color:var(--red-400);margin-top:2px">Frist abgelaufen</div>' : raid.deadline ? '<div style="font-size:10px;color:var(--green-400);margin-top:2px">Anmeldung offen</div>' : ''}
    </a>`;
  }

  const user = opts.user;
  const isCreator = user && raid.createdBy === user.userId;
  const officer = isOfficerUser();

  // Locked raid info for non-owners
  let lockInfoHtml = '';
  if (raid.locked) {
    lockInfoHtml = `<div style="font-size:var(--text-xs);color:var(--color-status-declined);margin-top:var(--sp-2)">Raid gesperrt \u2014 Anmeldung nicht mehr möglich</div>`;
  }

  // Status counts display
  let statusHtml = '';
  if (confirmed || accepted || tentative) {
    statusHtml = '<div style="font-size:var(--text-xs);color:var(--color-text-muted);margin-top:var(--sp-1);display:flex;gap:var(--sp-2)">';
    if (confirmed) statusHtml += `<span style="color:var(--green-400)">\u2713\u2713 ${confirmed} bestätigt</span>`;
    if (accepted) statusHtml += `<span style="color:var(--green-400)">\u2713 ${accepted} zugesagt</span>`;
    if (tentative) statusHtml += `<span style="color:var(--yellow-400)">? ${tentative} vielleicht</span>`;
    statusHtml += '</div>';
  }

  // Action buttons for owner
  let actionBtns = `<a href="#/raids/${raid.id}" class="btn-secondary" style="font-size:12px;padding:6px 14px">Details</a>`;
  if (isCreator) {
    actionBtns += ` <button class="btn-discord" data-raid-id="${raid.id}" style="font-size:12px;padding:6px 14px">${discordSvg(14)} Discord</button>`;
    if (raid.locked) {
      actionBtns += ` <button class="btn-raid-lock btn-secondary" data-raid-id="${raid.id}" data-lock-action="unlock" style="font-size:12px;padding:6px 14px"><span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle">lock_open</span> Entsperren</button>`;
    } else {
      actionBtns += ` <button class="btn-raid-lock btn-secondary" data-raid-id="${raid.id}" data-lock-action="lock" style="font-size:12px;padding:6px 14px"><span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle">lock</span> Sperren</button>`;
    }
  } else if (user && !raid.locked && !isPast) {
    const hasSignup = signups.some(s => s.userId === user.userId);
    if (!hasSignup) {
      actionBtns += ` <a href="#/raids/${raid.id}" class="btn-signup btn-primary" style="font-size:12px;padding:6px 14px">Anmelden</a>`;
    }
  }

  // DKP award button for past raids (officers/admins)
  if (isPast && officer) {
    actionBtns += ` <button class="btn-dkp-award btn-primary" data-raid-id="${raid.id}" style="font-size:12px;padding:6px 14px"><span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle">toll</span> DKP vergeben</button>`;
  }

  // Deadline badge
  let deadlineHtml = '';
  if (deadlinePassed) {
    deadlineHtml = '<span class="deadline-badge deadline-closed">Frist abgelaufen</span>';
  } else if (raid.deadline) {
    deadlineHtml = '<span class="deadline-badge deadline-open">Anmeldung offen</span>';
  }

  return `<div class="raid-card card${isPast ? ' raid-card-past' : ''}" data-testid="raid-card" data-raid-id="${raid.id}">
    <div class="raid-card-header">
      <span class="raid-inst">${h(raid.instance)}</span>
      <div style="display:flex;gap:var(--sp-2);align-items:center">
        ${deadlineHtml}
        ${raid.locked ? '<span class="raid-locked" title="Gesperrt"><span class="material-symbols-outlined" style="font-size:16px;vertical-align:middle">lock</span> Gesperrt</span>' : ''}
      </div>
    </div>
    <div class="raid-card-meta">
      <span>${dateStr} ${raid.time}</span>
      <span class="raid-signup-count">${signups.length}/${raid.maxPlayers} Anmeldungen</span>
    </div>
    ${roleBar(roles, raid.maxPlayers)}
    ${statusHtml}
    ${raid.description ? `<div class="raid-desc">${h(raid.description)}</div>` : ''}
    ${raid.notes ? `<div class="raid-notes">${h(raid.notes)}</div>` : ''}
    ${lockInfoHtml}
    <div class="raid-card-actions">
      ${actionBtns}
    </div>
  </div>`;
}

function discordSvg(size) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>`;
}

export function countRoles(signups) {
  let tanks = 0, healers = 0, dps = 0;
  signups.forEach(s => {
    if (s.status === 'declined') return;
    const role = s.role || 'DPS';
    if (role === 'Tank') tanks++;
    else if (role === 'Heiler') healers++;
    else dps++;
  });
  return { tanks, healers, dps };
}

export function roleBar(roles, max) {
  const total = roles.tanks + roles.healers + roles.dps;
  if (max <= 0) max = 25;
  return `<div class="role-bar">
    <div class="role-bar-segment" style="width:${(roles.tanks / max) * 100}%;background:var(--color-role-tank)" title="Tank: ${roles.tanks}"></div>
    <div class="role-bar-segment" style="width:${(roles.healers / max) * 100}%;background:var(--color-role-healer)" title="Heiler: ${roles.healers}"></div>
    <div class="role-bar-segment" style="width:${(roles.dps / max) * 100}%;background:var(--color-role-dps)" title="DPS: ${roles.dps}"></div>
  </div>
  <div class="role-bar-labels">
    <span style="color:var(--color-role-tank)">${roles.tanks}T</span>
    <span style="color:var(--color-role-healer)">${roles.healers}H</span>
    <span style="color:var(--color-role-dps)">${roles.dps}D</span>
  </div>`;
}
