// ── Analytics View (Auswertung) ──

import { getState, subscribe } from '../state.js';
import { h, cc, isRaidReady, hourQuarters } from '../utils.js';
import { CLS, ROLES, ROLE_ICONS, ROLE_COLORS, DAYS, HOUR_LABELS, DAY_SHORT, SLOTS } from '../constants.js';

let _unsub = [];

export function render(container) {
  _unsub.forEach(u => u());
  _unsub = [];
  _renderAnalytics(container);
  _unsub.push(subscribe('entries', () => _renderAnalytics(container)));
}

export function unmount() {
  _unsub.forEach(u => u());
  _unsub = [];
}

function _renderAnalytics(container) {
  const entries = getState('entries') || [];
  if (!entries.length) {
    container.innerHTML = '<div class="empty">Noch keine Daten für die Auswertung.</div>';
    return;
  }

  // Role distribution
  const rc = ROLES.map(r => ({ r, c: entries.filter(e => (e.roles || []).includes(r)).length }));
  const multiSpec = entries.filter(e => (e.specs || []).length > 1).length;
  const multi = entries.filter(e => (e.roles || []).length > 1).length;

  let roleHtml = `<div class="card"><div class="card-title">Rollenverteilung</div>
    <div class="role-an">${rc.map(({ r, c }) => {
      const pct = entries.length ? Math.round(c / entries.length * 100) : 0;
      return `<div class="role-an-item">
        <div class="big" style="color:${ROLE_COLORS[r]}">${c}</div>
        <div class="sm">${ROLE_ICONS[r]} ${r}</div>
        <div class="rprog"><div class="rprog-f" style="width:${pct}%;background:${ROLE_COLORS[r]}"></div></div>
        <div style="font-size:10px;color:var(--color-text-muted);margin-top:3px">${pct}%</div>
      </div>`;
    }).join('')}</div>
    <div class="flex-info">${multiSpec || multi} Spieler mit Mehrfach-Spec \u00B7 ${entries.length - (multiSpec || multi)} nur ein Spec</div>
  </div>`;

  // Class distribution
  const clsCounts = CLS.map(c => ({ ...c, count: entries.filter(e => e.className === c.n).length })).filter(c => c.count > 0).sort((a, b) => b.count - a.count);
  const mxCls = Math.max(1, ...clsCounts.map(c => c.count));

  let clsHtml = `<div class="card"><div class="card-title">Klassenverteilung</div>
    ${clsCounts.map(c => `<div class="bar-row">
      <span class="bar-lbl" style="color:${c.c}">${c.n}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${c.count / mxCls * 100}%;background:${c.c}40"></div><span class="bar-val" style="color:${c.c}">${c.count}\u00D7</span></div>
    </div>`).join('')}
  </div>`;

  // Best slots (hourly)
  const hd = {};
  DAYS.forEach(d => HOUR_LABELS.forEach(hl => {
    const k = d + '_' + hl;
    const qs = hourQuarters(hl).map(q => d + '_' + q);
    let yes = 0, tent = 0;
    entries.forEach(e => {
      const vals = qs.map(q => e.availability?.[q]);
      if (!vals.every(v => v === 'yes' || v === true || v === 'tentative')) return;
      if (vals.every(v => v === 'yes' || v === true)) yes++; else tent++;
    });
    hd[k] = { yes, tent, total: yes + tent };
  }));

  const best = Object.entries(hd).sort((a, b) => b[1].total - a[1].total).filter(([, v]) => v.total > 0).slice(0, 3);

  let bestHtml = `<div class="card card-full"><div class="card-title">Beste Raidzeiten \u2014 Details</div>
    ${best.map(([k, dat], i) => {
      const sep = k.indexOf('_'), d = k.substring(0, sep), hl = k.substring(sep + 1);
      const qs = hourQuarters(hl).map(q => d + '_' + q);
      const players = entries.filter(e => qs.every(q => e.availability?.[q])).map(e => {
        const allYes = qs.every(q => { const v = e.availability[q]; return v === 'yes' || v === true; });
        return { ...e, _availType: allYes ? 'yes' : 'tentative' };
      });
      const rr = isRaidReady(players);
      const byRole = ROLES.map(r => ({ r, ps: players.filter(p => (p.roles || []).includes(r)) }));
      return `<div class="bs-card" style="background:${i === 0 ? 'rgba(201,168,76,.06)' : 'rgba(255,255,255,.015)'};border:1px solid ${i === 0 ? 'rgba(201,168,76,.2)' : 'rgba(255,255,255,.04)'}">
        <div class="bs-hdr"><span class="rank" style="color:${i === 0 ? 'var(--color-accent)' : 'var(--gray-400)'}">#${i + 1} ${d} ${hl}:00</span><span class="avail">${dat.total} verfügbar${dat.tent > 0 ? ` (${dat.tent} vielleicht)` : ''}</span>${rr.ready ? '<span class="badge-rr">Raid-Ready!</span>' : ''}</div>
        <div class="bs-roles">${byRole.map(({ r, ps }) => `
          <div class="bs-role">
            <div class="bs-role-t" style="color:${ROLE_COLORS[r]}">${ROLE_ICONS[r]} ${r} (${ps.length})</div>
            ${ps.length ? ps.map(p => `<div class="bs-player" style="color:${p._availType === 'tentative' ? 'var(--color-status-tentative)' : cc(p.className)}">${p._availType === 'tentative' ? '(?) ' : ''}${h(p.charName)}</div>`).join('') : '<div style="font-size:11px;color:var(--gray-800)">\u2014</div>'}
          </div>
        `).join('')}</div>
      </div>`;
    }).join('')}
  </div>`;

  // Player availability ranking
  const pSlots = entries.map(e => {
    const cnt = DAYS.reduce((s, d) => s + SLOTS.filter(sl => e.availability?.[d + '_' + sl]).length, 0);
    return { ...e, sc: cnt };
  }).sort((a, b) => b.sc - a.sc);
  const mxSlots = Math.max(1, ...pSlots.map(p => p.sc));

  let playerHtml = `<div class="card card-full"><div class="card-title">Verfügbarkeit pro Spieler</div>
    ${pSlots.slice(0, 15).map(p => `<div class="pbar-row">
      <span class="pbar-name" style="color:${cc(p.className)}">${h(p.charName)}</span>
      <div class="pbar-track"><div class="pbar-fill" style="width:${p.sc / mxSlots * 100}%"></div></div>
      <span class="pbar-val">${Math.round(p.sc / (SLOTS.length * DAYS.length) * 100)}%</span>
    </div>`).join('')}
  </div>`;

  container.innerHTML = `<div class="analytics-grid">
    ${roleHtml}
    ${clsHtml}
    ${bestHtml}
    ${playerHtml}
  </div>`;
}
