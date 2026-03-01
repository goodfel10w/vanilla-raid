// ── Dashboard View ──

import { getState, subscribe } from '../state.js';
import { h, cc, timeAgo, formatDate } from '../utils.js';
import { CLS, ROLES, ROLE_COLORS, ROLE_ICONS } from '../constants.js';
import { raidCard } from '../components/raid-card.js';
import { roleBarFull } from '../components/role-bar.js';
import { skeletonCard, skeletonList } from '../components/skeleton.js';
import { isAdminUser, isOfficerUser } from '../auth.js';

let _unsub = [];

export function render(container) {
  _unsub.forEach(u => u());
  _unsub = [];
  _renderContent(container);
  _unsub.push(subscribe('entries', () => _renderContent(container)));
  _unsub.push(subscribe('raids', () => _renderContent(container)));
}

export function unmount() {
  _unsub.forEach(u => u());
  _unsub = [];
}

function _renderContent(container) {
  const entries = getState('entries');
  const raids = getState('raids');

  // Show skeleton while data hasn't loaded yet
  if (entries === undefined || entries === null) {
    container.innerHTML = `
      <div class="center" style="margin-bottom:var(--sp-8)">
        <div style="font-size:11px;letter-spacing:6px;text-transform:uppercase;color:var(--color-text-muted);margin-bottom:4px">&lt;Vanilla&gt; Gilde</div>
        <h1>Raid-Planer</h1>
        <div style="color:var(--color-text-muted);font-size:var(--text-sm);margin-top:4px;font-style:italic">The Burning Crusade</div>
      </div>
      <div class="dashboard-grid">
        ${skeletonCard()}${skeletonCard()}${skeletonCard()}
        <div class="card card-full">${skeletonList(5)}</div>
      </div>`;
    return;
  }
  const safeEntries = entries || [];
  const safeRaids = raids || [];
  const user = getState('auth.user');
  const isAdmin = isAdminUser();
  const isOfficer = isOfficerUser();

  // Upcoming raids: sorted by date, future only
  const now = new Date();
  const allUpcoming = safeRaids
    .filter(r => new Date(r.date + 'T' + (r.time || '20:00')) >= now)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const upcoming = allUpcoming.slice(0, 5);
  const overflowCount = allUpcoming.length - 5;

  // Recent entries for activity feed
  const recentEntries = [...safeEntries]
    .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
    .slice(0, 5);

  // Stats
  const totalRaiders = safeEntries.length;
  const upcomingCount = allUpcoming.length;

  // Role distribution from entries
  const roleCounts = { Tank: 0, Heiler: 0, DPS: 0 };
  safeEntries.forEach(e => {
    (e.roles || []).forEach(r => {
      if (roleCounts[r] !== undefined) roleCounts[r]++;
    });
  });

  // Class distribution
  const classCounts = {};
  safeEntries.forEach(e => {
    if (e.className) classCounts[e.className] = (classCounts[e.className] || 0) + 1;
  });
  const classEntries = Object.entries(classCounts).sort((a, b) => b[1] - a[1]);
  const maxClassCount = classEntries.length ? classEntries[0][1] : 1;

  let html = `
    <div class="center" style="margin-bottom:var(--sp-8)">
      <div style="font-size:11px;letter-spacing:6px;text-transform:uppercase;color:var(--color-text-muted);margin-bottom:4px">&lt;Vanilla&gt; Gilde</div>
      <h1>Raid-Planer</h1>
      <div style="color:var(--color-text-muted);font-size:var(--text-sm);margin-top:4px;font-style:italic">The Burning Crusade</div>
      <div style="color:var(--color-text-muted);font-size:var(--text-sm);margin-top:6px" data-testid="entry-count">${totalRaiders} Raider eingetragen</div>
    </div>

    <div class="dashboard-grid">
      <div class="card card-full">
        <div class="card-title">Schnellzugriff</div>
        <div class="quick-actions">
          <a class="quick-action" href="#/form">
            <span class="quick-action-icon"><span class="material-symbols-outlined">edit_note</span></span>
            <span>Verfügbarkeit eintragen</span>
          </a>
          <a class="quick-action" href="#/raids">
            <span class="quick-action-icon"><span class="material-symbols-outlined">swords</span></span>
            <span>Raids anzeigen</span>
          </a>
          <a class="quick-action" href="#/roster">
            <span class="quick-action-icon"><span class="material-symbols-outlined">groups</span></span>
            <span>Aufstellung</span>
          </a>
          <a class="quick-action" href="#/heatmap">
            <span class="quick-action-icon"><span class="material-symbols-outlined">local_fire_department</span></span>
            <span>Heatmap</span>
          </a>
        </div>
      </div>`;

  // "Deine Anmeldungen" card (logged-in users)
  if (user) {
    const mySignups = allUpcoming
      .filter(r => (r.signups || []).some(s => s.userId === user.userId))
      .slice(0, 5);
    const raidsWithoutSignup = allUpcoming
      .filter(r => !(r.signups || []).some(s => s.userId === user.userId))
      .slice(0, 3);

    html += `<div class="card card-full">
      <div class="card-title">Deine Anmeldungen</div>`;
    if (mySignups.length) {
      html += '<div class="dashboard-signups">';
      mySignups.forEach(r => {
        const su = (r.signups || []).find(s => s.userId === user.userId);
        const statusLabels = { confirmed: 'Bestätigt', accepted: 'Zugesagt', tentative: 'Vielleicht', benched: 'Bank', declined: 'Abgesagt' };
        const stLabel = statusLabels[su?.status] || su?.status || '';
        html += `<a href="#/raids/${r.id}" class="dashboard-signup-row">
          <span class="raid-inst" style="font-size:var(--text-sm)">${h(r.instance)}</span>
          <span style="font-size:var(--text-xs);color:var(--color-text-muted)">${formatDate(r.date)} ${r.time || ''}</span>
          <span class="raid-signup-status signup-${su?.status || 'accepted'}" style="font-size:10px">${stLabel}</span>
        </a>`;
      });
      html += '</div>';
    } else {
      html += '<div class="empty" style="font-size:var(--text-sm)">Du bist für keine kommenden Raids angemeldet</div>';
    }
    if (raidsWithoutSignup.length) {
      html += `<div style="margin-top:var(--sp-3);font-size:var(--text-xs);color:var(--yellow-400)">
        \u26A0 ${raidsWithoutSignup.length} Raid${raidsWithoutSignup.length > 1 ? 's' : ''} ohne Anmeldung:
        ${raidsWithoutSignup.map(r => `<a href="#/raids/${r.id}" style="color:var(--color-accent)">${h(r.instance)}</a>`).join(', ')}
      </div>`;
    }
    html += '</div>';
  }

  // Raid-lead quick actions (officers/admins)
  if (isAdmin || isOfficer) {
    const warnings = [];
    allUpcoming.forEach(r => {
      const su = r.signups || [];
      const confirmed = su.filter(s => s.status === 'confirmed').length;
      const total = su.filter(s => s.status !== 'declined').length;
      if (confirmed === 0 && total > 0) {
        warnings.push({ raid: r, type: 'no-lineup', msg: `${r.instance} (${formatDate(r.date)}): keine bestätigte Aufstellung` });
      }
      if (total < r.maxPlayers * 0.5) {
        warnings.push({ raid: r, type: 'low-signups', msg: `${r.instance} (${formatDate(r.date)}): weniger als 50% Anmeldungen (${total}/${r.maxPlayers})` });
      }
    });
    if (warnings.length) {
      html += `<div class="card card-full">
        <div class="card-title">Raid-Leitung</div>
        <div class="dashboard-warnings">
          ${warnings.map(w => `<div class="dashboard-warning">
            <span class="material-symbols-outlined" style="font-size:16px;color:var(--yellow-400)">warning</span>
            <a href="#/raids/${w.raid.id}" style="color:var(--color-text-secondary)">${h(w.msg)}</a>
          </div>`).join('')}
        </div>
      </div>`;
    }
  }

  // Upcoming raids
  if (upcoming.length) {
    html += `<div class="card${upcoming.length <= 2 ? ' card-full' : ''}">
      <div class="card-title">Nächste Raids</div>
      <div class="upcoming-raids">
        ${upcoming.map(r => raidCard(r, { compact: true })).join('')}
      </div>
      ${overflowCount > 0 ? `<a href="#/raids" style="display:block;text-align:center;font-size:var(--text-xs);color:var(--color-accent);margin-top:var(--sp-2)">+${overflowCount} weitere</a>` : ''}
    </div>`;
  } else {
    html += `<div class="card">
      <div class="card-title">Nächste Raids</div>
      <div class="empty">Keine geplanten Raids</div>
    </div>`;
  }

  // Activity feed
  html += `<div class="card${upcoming.length <= 2 ? '' : ' card-full'}">
    <div class="card-title">Letzte Aktivität</div>`;
  if (recentEntries.length) {
    html += '<div class="activity-list">';
    recentEntries.forEach(e => {
      html += `<div class="activity-item">
        <span class="activity-icon" style="color:${cc(e.className)}"><span class="material-symbols-outlined" style="font-size:18px">person</span></span>
        <span><strong style="color:${cc(e.className)}">${h(e.charName)}</strong> hat sich eingetragen</span>
        ${e.timestamp ? `<span class="activity-time">${timeAgo(e.timestamp)}</span>` : ''}
      </div>`;
    });
    html += '</div>';
  } else {
    html += '<div class="empty">Noch keine Aktivität</div>';
  }
  html += '</div>';

  // Role distribution
  html += `<div class="card">
    <div class="card-title">Rollenverteilung</div>
    ${roleBarFull(roleCounts, { Tank: Math.max(roleCounts.Tank, 2), Heiler: Math.max(roleCounts.Heiler, 5), DPS: Math.max(roleCounts.DPS, 18) })}
  </div>`;

  // Class distribution
  if (classEntries.length) {
    html += `<div class="card">
      <div class="card-title">Klassenverteilung</div>
      <div class="class-dist-dashboard">
        ${classEntries.map(([cls, count]) => {
          const pct = (count / maxClassCount) * 100;
          return `<div class="class-dist-row">
            <span class="class-dist-label" style="color:${cc(cls)}">${h(cls)}</span>
            <div class="class-dist-track">
              <div class="class-dist-bar" style="width:${pct}%;background:${cc(cls)}"></div>
            </div>
            <span class="class-dist-count">${count}</span>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }

  // Stats summary
  html += `<div class="card card-full">
    <div class="card-title">Übersicht</div>
    <div style="display:flex;gap:var(--sp-8);justify-content:center;flex-wrap:wrap;padding:var(--sp-4) 0">
      <div style="text-align:center">
        <div style="font-size:28px;font-weight:700;color:var(--color-accent)">${totalRaiders}</div>
        <div style="font-size:var(--text-xs);color:var(--color-text-muted)">Raider</div>
      </div>
      <div style="text-align:center">
        <div style="font-size:28px;font-weight:700;color:var(--color-accent)">${upcomingCount}</div>
        <div style="font-size:var(--text-xs);color:var(--color-text-muted)">Geplante Raids</div>
      </div>
      <div style="text-align:center">
        <div style="font-size:28px;font-weight:700;color:var(--color-accent)">${safeRaids.length}</div>
        <div style="font-size:var(--text-xs);color:var(--color-text-muted)">Raids gesamt</div>
      </div>
    </div>
  </div>`;

  html += '</div>';
  container.innerHTML = html;
}
