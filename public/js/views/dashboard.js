// ── Dashboard View ──

import { getState, subscribe } from '../state.js';
import { h, cc, timeAgo } from '../utils.js';
import { raidCard } from '../components/raid-card.js';
import { skeletonCard, skeletonList } from '../components/skeleton.js';

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

  // Upcoming raids: sorted by date, future only
  const now = new Date();
  const upcoming = safeRaids
    .filter(r => new Date(r.date + 'T' + (r.time || '20:00')) >= now)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 3);

  // Recent entries for activity feed
  const recentEntries = [...safeEntries]
    .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
    .slice(0, 5);

  // Stats
  const totalRaiders = safeEntries.length;
  const upcomingCount = safeRaids.filter(r => new Date(r.date + 'T' + (r.time || '20:00')) >= now).length;

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

  // Upcoming raids
  if (upcoming.length) {
    html += `<div class="card${upcoming.length <= 2 ? ' card-full' : ''}">
      <div class="card-title">Nächste Raids</div>
      <div class="upcoming-raids">
        ${upcoming.map(r => raidCard(r, { compact: true })).join('')}
      </div>
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
