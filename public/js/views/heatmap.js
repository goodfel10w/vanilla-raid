// ── Heatmap View ──

import { getState, update, subscribe } from '../state.js';
import { h, cc, isRaidReady, hourQuarters } from '../utils.js';
import { DAYS, WD, WE, HOUR_LABELS, DAY_SHORT, ROLES, ROLE_ICONS } from '../constants.js';

let _unsub = [];

export function render(container) {
  _unsub.forEach(u => u());
  _unsub = [];
  _renderHeatmap(container);
  _unsub.push(subscribe('entries', () => _renderHeatmap(container)));
}

export function unmount() {
  _unsub.forEach(u => u());
  _unsub = [];
}

function _heatData(entries) {
  const hd = {};
  DAYS.forEach(d => HOUR_LABELS.forEach(hl => {
    const k = d + '_' + hl;
    const qs = hourQuarters(hl).map(q => d + '_' + q);
    let yes = 0, tent = 0;
    entries.forEach(e => {
      const vals = qs.map(q => e.availability?.[q]);
      const allAvail = vals.every(v => v === 'yes' || v === true || v === 'tentative');
      if (!allAvail) return;
      if (vals.every(v => v === 'yes' || v === true)) yes++; else tent++;
    });
    hd[k] = { yes, tent, total: yes + tent };
  }));
  return hd;
}

function _heatData3h(entries) {
  const hd = {};
  DAYS.forEach(d => {
    for (let hr = 12; hr <= 21; hr++) {
      const endH = hr + 3;
      const label = String(hr).padStart(2, '0') + ':00\u2013' + String(endH === 24 ? 0 : endH).padStart(2, '0') + ':00';
      const k = d + '_' + label;
      const qs = [];
      for (let wh = hr; wh < endH; wh++) for (const m of [0, 15, 30, 45]) qs.push(d + '_' + String(wh).padStart(2, '0') + ':' + String(m).padStart(2, '0'));
      let yes = 0, tent = 0;
      entries.forEach(e => {
        const vals = qs.map(q => e.availability?.[q]);
        if (!vals.every(v => v === 'yes' || v === true || v === 'tentative')) return;
        if (vals.every(v => v === 'yes' || v === true)) yes++; else tent++;
      });
      hd[k] = { yes, tent, total: yes + tent };
    }
  });
  return hd;
}

function _heatData4h(entries) {
  const hd = {};
  DAYS.forEach(d => {
    for (let hr = 12; hr <= 20; hr++) {
      const endH = hr + 4;
      const label = String(hr).padStart(2, '0') + ':00\u2013' + String(endH === 24 ? 0 : endH).padStart(2, '0') + ':00';
      const k = d + '_' + label;
      const qs = [];
      for (let wh = hr; wh < endH; wh++) for (const m of [0, 15, 30, 45]) qs.push(d + '_' + String(wh).padStart(2, '0') + ':' + String(m).padStart(2, '0'));
      let yes = 0, tent = 0;
      entries.forEach(e => {
        const vals = qs.map(q => e.availability?.[q]);
        if (!vals.every(v => v === 'yes' || v === true || v === 'tentative')) return;
        if (vals.every(v => v === 'yes' || v === true)) yes++; else tent++;
      });
      hd[k] = { yes, tent, total: yes + tent };
    }
  });
  return hd;
}

function _windowLabels(hours) {
  const labels = [];
  const maxStart = 24 - hours;
  for (let hr = 12; hr <= maxStart; hr++) {
    const endH = hr + hours;
    labels.push(String(hr).padStart(2, '0') + ':00\u2013' + String(endH === 24 ? 0 : endH).padStart(2, '0') + ':00');
  }
  return labels;
}

function _avForSlot(entries, d, hl) {
  const qs = hourQuarters(hl).map(q => d + '_' + q);
  return entries.filter(e => qs.every(q => e.availability?.[q])).map(e => {
    const allYes = qs.every(q => { const v = e.availability[q]; return v === 'yes' || v === true; });
    return { ...e, _availType: allYes ? 'yes' : 'tentative' };
  });
}

function _avForWindow(entries, d, label, hours) {
  const parts = label.split('\u2013');
  const startH = parseInt(parts[0]);
  let endH = parseInt(parts[1]);
  if (endH === 0) endH = 24;
  const qs = [];
  for (let wh = startH; wh < endH; wh++) for (const m of [0, 15, 30, 45]) qs.push(d + '_' + String(wh).padStart(2, '0') + ':' + String(m).padStart(2, '0'));
  return entries.filter(e => qs.every(q => e.availability?.[q])).map(e => {
    const allYes = qs.every(q => { const v = e.availability[q]; return v === 'yes' || v === true; });
    return { ...e, _availType: allYes ? 'yes' : 'tentative' };
  });
}

function _renderHeatmap(container) {
  const entries = getState('entries') || [];
  const heatMode = getState('ui.heatMode') || '1h';
  const is3h = heatMode === '3h', is4h = heatMode === '4h', isWindow = is3h || is4h;
  const hd = is4h ? _heatData4h(entries) : is3h ? _heatData3h(entries) : _heatData(entries);
  const mx = Math.max(1, ...Object.values(hd).map(v => v.total));

  function makeCell(k, players, dat) {
    const c = dat.total, i = c / mx;
    const rr = isRaidReady(players);
    const rrCls = rr.ready ? ' raid-ready' : '';
    let roleBadges = '';
    if (c > 0) roleBadges = `<div class="hcell-roles"><span style="color:var(--color-role-tank)">${rr.t}T</span> <span style="color:var(--color-role-healer)">${rr.hl}H</span> <span style="color:var(--color-role-dps)">${rr.dp}D</span></div>`;
    let tipHdr = '';
    if (c > 0) tipHdr = `<div style="margin-bottom:4px;font-weight:600">${ROLE_ICONS.Tank}${rr.t} ${ROLE_ICONS.Heiler}${rr.hl} ${ROLE_ICONS.DPS}${rr.dp}${rr.ready ? ' \u2014 <span style="color:var(--color-status-confirmed)">Raid-Ready!</span>' : ''}</div>`;
    const tipPlayers = players.length ? players.map(p => `<div style="color:${p._availType === 'tentative' ? 'var(--color-status-tentative)' : cc(p.className)}">${p._availType === 'tentative' ? '(?) ' : ''}${h(p.charName)}</div>`).join('') : '<div style="color:var(--color-text-muted)">Niemand</div>';
    let countStr = c.toString();
    if (dat.tent > 0) countStr = `${dat.yes}<span style="font-size:12px;font-weight:400;color:var(--color-status-tentative)">+${dat.tent}</span>`;
    return `<td><div class="hcell${rrCls}" style="background:${c ? `rgba(201,168,76,${.08 + i * .35})` : 'rgba(255,255,255,.02)'};color:${c ? `rgba(201,168,76,${.4 + i * .6})` : '#2a2538'};border:1px solid rgba(201,168,76,${c ? .1 + i * .3 : .02})">${countStr}${roleBadges}<template class="tip-content">${tipHdr}${tipPlayers}</template></div></td>`;
  }

  const cols = is4h ? _windowLabels(4) : is3h ? _windowLabels(3) : HOUR_LABELS;
  let wdRows = '', weRows = '';
  WD.forEach(d => {
    wdRows += `<tr><td class="dl">${d}</td>${cols.map(c => {
      const k = d + '_' + c;
      const players = isWindow ? _avForWindow(entries, d, c, is4h ? 4 : 3) : _avForSlot(entries, d, c);
      return makeCell(k, players, hd[k] || { yes: 0, tent: 0, total: 0 });
    }).join('')}</tr>`;
  });
  WE.forEach(d => {
    weRows += `<tr><td class="dl">${d}</td>${cols.map(c => {
      const k = d + '_' + c;
      const players = isWindow ? _avForWindow(entries, d, c, is4h ? 4 : 3) : _avForSlot(entries, d, c);
      return makeCell(k, players, hd[k] || { yes: 0, tent: 0, total: 0 });
    }).join('')}</tr>`;
  });

  // Top slots
  const sorted = Object.entries(hd).sort((a, b) => b[1].total - a[1].total).filter(([, v]) => v.total > 0).slice(0, 5);
  let topHtml = '';
  if (sorted.length) {
    topHtml = `<div class="center" style="margin-top:var(--sp-5)">
      <div class="sec-label" style="margin-bottom:10px">Top ${Math.min(5, sorted.length)} Raidzeiten${isWindow ? ` (${is4h ? '4h' : '3h'})` : ''}</div>
      <div class="top-slots">${sorted.map(([k, dat], i) => {
        const sep = k.indexOf('_'), d = k.substring(0, sep), s = k.substring(sep + 1);
        const players = isWindow ? _avForWindow(entries, d, s, is4h ? 4 : 3) : _avForSlot(entries, d, s);
        const rr = isRaidReady(players);
        return `<div class="tslot" style="background:${i === 0 ? 'rgba(201,168,76,.12)' : 'rgba(255,255,255,.03)'};border:1px solid ${i === 0 ? 'rgba(201,168,76,.3)' : 'var(--color-border-default)'}">
          <div class="ts-t" style="color:${i === 0 ? 'var(--color-accent)' : 'var(--gray-400)'}">#${i + 1} ${DAY_SHORT[d] || d} ${isWindow ? s : s + ':00'}</div>
          <div class="ts-c">${dat.total} Raider${dat.tent > 0 ? ` (${dat.tent} vielleicht)` : ''}</div>
          ${rr.ready ? '<div class="badge-rr" style="margin-top:4px">Raid-Ready!</div>' : ''}
        </div>`;
      }).join('')}</div>
    </div>`;
  }

  container.innerHTML = `
    <div class="segmented" style="display:flex;justify-content:center;margin-bottom:var(--sp-4)">
      <button class="seg-btn ht-btn${heatMode === '1h' ? ' active' : ''}" data-hmode="1h">1h Stunden</button>
      <button class="seg-btn ht-btn${heatMode === '3h' ? ' active' : ''}" data-hmode="3h">3h Fenster</button>
      <button class="seg-btn ht-btn${heatMode === '4h' ? ' active' : ''}" data-hmode="4h">4h Raid</button>
    </div>
    <p class="center" style="font-size:var(--text-sm);color:var(--color-text-muted);margin-bottom:var(--sp-4)">Heller = mehr Raider \u00B7 Hover für Details \u00B7 Grüner Rand = Raid-Ready${isWindow ? ` \u00B7 ${is4h ? '4h' : '3h'} = alle Viertelstunden im Fenster verfügbar` : ''}</p>
    <div class="card" style="overflow-x:auto">
      <div class="sec-label sec-l">Unter der Woche</div>
      <table class="htable"><thead><tr><th></th>${cols.map(s => `<th>${s}</th>`).join('')}</tr></thead><tbody>${wdRows}</tbody></table>
    </div>
    <div class="card" style="overflow-x:auto">
      <div class="sec-label sec-l">Wochenende</div>
      <table class="htable"><thead><tr><th></th>${cols.map(s => `<th>${s}</th>`).join('')}</tr></thead><tbody>${weRows}</tbody></table>
    </div>
    ${topHtml}
    <div class="tooltip" id="htooltip"></div>`;

  // Mode switch events
  container.querySelectorAll('[data-hmode]').forEach(btn => {
    btn.addEventListener('click', () => {
      update('ui.heatMode', btn.dataset.hmode);
      _renderHeatmap(container);
    });
  });

  // Tooltip events
  _attachTooltip(container);
}

function _attachTooltip(container) {
  const tip = container.querySelector('#htooltip');
  if (!tip) return;

  container.addEventListener('mouseenter', e => {
    const cell = e.target.closest('.hcell');
    if (!cell) return;
    const tpl = cell.querySelector('.tip-content');
    if (!tpl) return;
    tip.innerHTML = tpl.innerHTML;
    const r = cell.getBoundingClientRect();
    const tw = tip.offsetWidth || 160, th = tip.offsetHeight || 40;
    const above = r.top - th - 10 > 0;
    let top = above ? r.top - th - 10 : r.bottom + 10;
    let left = r.left + r.width / 2 - tw / 2;
    const margin = 4;
    if (left < margin) left = margin;
    if (left + tw > window.innerWidth - margin) left = window.innerWidth - margin - tw;
    const cellCenter = r.left + r.width / 2;
    const arrowLeft = Math.max(12, Math.min(tw - 12, cellCenter - left));
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
    tip.style.setProperty('--arrow-left', arrowLeft + 'px');
    tip.classList.remove('arrow-down', 'arrow-up');
    tip.classList.add(above ? 'arrow-down' : 'arrow-up');
    tip.classList.add('show');
  }, true);

  container.addEventListener('mouseleave', e => {
    const cell = e.target.closest('.hcell');
    if (!cell) return;
    tip.classList.remove('show', 'arrow-down', 'arrow-up');
  }, true);
}
