// ── DKP View ──

import { getState, update, subscribe } from '../state.js';
import { api, DKP_API } from '../api.js';
import { h, cc, linkItems, timeAgo, formatDate } from '../utils.js';
import { CLS, ROLES } from '../constants.js';
import { showModal, showConfirm } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { navigate } from '../router.js';
import { isAdminUser } from '../auth.js';
import { loadData } from '../app.js';

let _unsub = [];

export function render(container, params) {
  _unsub.forEach(u => u());
  _unsub = [];

  if (params?.name) {
    update('ui.dkpPlayerDetail', params.name);
    update('ui.dkpView', 'overview');
  }

  _renderDkp(container);
  _unsub.push(subscribe('dkp', () => _renderDkp(container)));
}

export function unmount() {
  _unsub.forEach(u => u());
  _unsub = [];
}

function _isDkpAdmin() {
  return isAdminUser() || _isDkpRole('admin');
}

function _isDkpOfficer() {
  return _isDkpAdmin() || _isDkpRole('officer');
}

function _isDkpRole(role) {
  const user = getState('auth.user');
  if (!user) return false;
  const config = getState('dkp.config');
  if (!config?.roles) return false;
  const username = user.username?.toLowerCase()?.split('#')[0];
  return Object.entries(config.roles).some(([u, r]) => u.toLowerCase() === username && r === role);
}

function _sortedBalances() {
  const balances = getState('dkp.balances') || [];
  const col = getState('ui.dkpSortCol') || 'balance';
  const dir = getState('ui.dkpSortDir') || 'desc';
  return [...balances].sort((a, b) => {
    let cmp = 0;
    if (col === 'name') cmp = a.playerName.localeCompare(b.playerName);
    else if (col === 'class') cmp = (a.className || '').localeCompare(b.className || '');
    else cmp = (a.balance || 0) - (b.balance || 0);
    return dir === 'asc' ? cmp : -cmp;
  });
}

function _renderDkp(container) {
  const admin = _isDkpAdmin();
  const officer = _isDkpOfficer();
  const dkpView = getState('ui.dkpView') || 'overview';
  const user = getState('auth.user');
  const balances = getState('dkp.balances') || [];

  // Find current user's DKP entry (match by charName from entries or by username)
  const entries = getState('entries') || [];
  const myEntry = user ? entries.find(e => e.userId === user.userId) : null;
  const myDkp = user ? balances.find(b => {
    const lower = b.playerName.toLowerCase();
    const uLower = user.username?.toLowerCase() || '';
    if (lower === uLower || lower === uLower.split('#')[0]) return true;
    if (myEntry && lower === myEntry.charName.toLowerCase()) return true;
    return false;
  }) : null;

  let html = `<div class="segmented dkp-actions-bar">
    <button class="seg-btn${dkpView === 'overview' ? ' active' : ''}" data-dkpview="overview">Übersicht</button>
    ${user && myDkp ? `<button class="seg-btn dkp-my-btn${dkpView === 'mydkp' ? ' active' : ''}" data-dkpview="mydkp">Mein DKP</button>` : ''}
    ${officer ? `<button class="seg-btn${dkpView === 'award' ? ' active' : ''}" data-dkpview="award">Vergeben</button>
    <button class="seg-btn${dkpView === 'spend' ? ' active' : ''}" data-dkpview="spend">Beute</button>` : ''}
    ${admin ? `<button class="seg-btn${dkpView === 'decay' ? ' active' : ''}" data-dkpview="decay">Verfall</button>
    <button class="seg-btn${dkpView === 'settings' ? ' active' : ''}" data-dkpview="settings">Einstellungen</button>` : ''}
  </div>`;

  if (dkpView === 'award' && officer) html += _renderAward();
  else if (dkpView === 'spend' && officer) html += _renderSpend();
  else if (dkpView === 'decay' && admin) html += _renderDecay();
  else if (dkpView === 'settings' && admin) html += _renderSettings();
  else if (dkpView === 'mydkp' && myDkp) { update('ui.dkpPlayerDetail', myDkp.playerName); html += _renderOverview(); }
  else html += _renderOverview();

  container.innerHTML = html;

  // Tab events
  container.querySelectorAll('[data-dkpview]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.dkpview !== 'overview') update('ui.dkpPlayerDetail', null);
      update('ui.dkpView', btn.dataset.dkpview);
      _renderDkp(container);
    });
  });

  // Sort events
  container.querySelectorAll('[data-dkp-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.dkpSort;
      const curCol = getState('ui.dkpSortCol');
      const curDir = getState('ui.dkpSortDir');
      update('ui.dkpSortCol', col);
      update('ui.dkpSortDir', curCol === col ? (curDir === 'asc' ? 'desc' : 'asc') : 'asc');
      _renderDkp(container);
    });
  });

  // Search
  container.querySelector('#dkp-search-input')?.addEventListener('input', function () {
    update('ui.dkpSearchQuery', this.value);
    _renderDkp(container);
  });

  // Player row clicks
  container.querySelectorAll('[data-dkp-player]').forEach(row => {
    row.addEventListener('click', () => {
      update('ui.dkpPlayerDetail', row.dataset.dkpPlayer);
      _renderDkp(container);
    });
  });

  // Back from detail
  container.querySelector('#dkp-back')?.addEventListener('click', () => {
    update('ui.dkpPlayerDetail', null);
    _renderDkp(container);
  });

  // Transaction filters
  container.querySelectorAll('[data-txfilter]').forEach(btn => {
    btn.addEventListener('click', () => {
      update('ui.dkpTxFilter', btn.dataset.txfilter);
      _renderDkp(container);
    });
  });

  // Form submissions
  container.querySelector('#dkp-award-submit')?.addEventListener('click', () => _doAward(container));
  container.querySelector('#dkp-spend-submit')?.addEventListener('click', () => _doSpend(container));
  container.querySelector('#dkp-decay-submit')?.addEventListener('click', () => _doDecay(container));
  container.querySelector('#dkp-cfg-save')?.addEventListener('click', () => _doSaveConfig(container));
  container.querySelector('#dkp-cfg-save-2')?.addEventListener('click', () => _doSaveConfig(container));

  // Player selection chips
  container.querySelectorAll('[data-dkp-select-player]').forEach(chip => {
    chip.addEventListener('click', () => {
      const name = chip.dataset.dkpSelectPlayer;
      const players = getState('ui.dkpAwardPlayers') || [];
      if (players.includes(name)) update('ui.dkpAwardPlayers', players.filter(p => p !== name));
      else update('ui.dkpAwardPlayers', [...players, name]);
      _renderDkp(container);
    });
  });

  // Select all
  container.querySelector('.dkp-selectall')?.addEventListener('click', () => {
    const balances = getState('dkp.balances') || [];
    const entries = getState('entries') || [];
    const playerNames = new Set(balances.map(b => b.playerName));
    entries.forEach(e => playerNames.add(e.charName));
    const allPlayers = [...playerNames];
    const selected = getState('ui.dkpAwardPlayers') || [];
    if (selected.length === allPlayers.length) {
      update('ui.dkpAwardPlayers', []);
    } else {
      update('ui.dkpAwardPlayers', allPlayers);
    }
    _renderDkp(container);
  });

  // Award amount/reason live update for preview
  container.querySelector('#dkp-award-amount')?.addEventListener('input', function () {
    update('ui.dkpAwardAmount', this.value);
    _renderDkp(container);
  });
  container.querySelector('#dkp-award-reason')?.addEventListener('input', function () {
    update('ui.dkpAwardReason', this.value);
  });

  // Raid picker change
  container.querySelector('#dkp-raid-picker')?.addEventListener('change', function () {
    const raidId = this.value;
    if (!raidId) return;
    const raids = getState('raids') || [];
    const raid = raids.find(r => r.id === raidId);
    if (!raid) return;
    const su = (raid.signups || []).filter(s => s.status !== 'declined');
    update('ui.dkpAwardPlayers', su.map(s => s.charName));
    update('ui.dkpAwardReason', raid.instance + ' ' + formatDate(raid.date));
    _renderDkp(container);
  });

  // Spend form: enable/disable submit based on fields
  const spendPlayer = container.querySelector('#dkp-spend-player');
  const spendAmount = container.querySelector('#dkp-spend-amount');
  const spendSubmit = container.querySelector('#dkp-spend-submit');
  const spendMax = container.querySelector('.dkp-spend-max');
  if (spendPlayer && spendAmount && spendSubmit) {
    const balances = getState('dkp.balances') || [];
    const config = getState('dkp.config') || {};
    const updateSpendBtn = () => {
      spendSubmit.disabled = !spendPlayer.value || !spendAmount.value;
      if (spendMax && !config.allowNegativeBalance && spendPlayer.value) {
        const bal = balances.find(b => b.playerName === spendPlayer.value);
        if (bal) {
          spendMax.textContent = `Max. verfügbar: ${bal.balance} DKP`;
          spendMax.style.display = '';
        }
      } else if (spendMax) {
        spendMax.style.display = 'none';
      }
    };
    spendPlayer.addEventListener('change', updateSpendBtn);
    spendAmount.addEventListener('input', updateSpendBtn);
  }

  // Undo
  container.querySelector('#dkp-undo')?.addEventListener('click', () => _doUndo(container));

  // CSV Export
  container.querySelector('#dkp-csv')?.addEventListener('click', _exportDkpCsv);

  // Transaction edit/delete buttons
  container.querySelectorAll('.dkp-tx-btn:not(.dkp-tx-del)').forEach(btn => {
    btn.addEventListener('click', () => _editTransaction(container, btn.dataset.txId));
  });
  container.querySelectorAll('.dkp-tx-btn.dkp-tx-del').forEach(btn => {
    btn.addEventListener('click', () => _deleteTransaction(container, btn.dataset.txId));
  });

  // Player detail admin actions
  container.querySelector('#dkp-adjust-btn')?.addEventListener('click', () => _adjustBalance(container));
  container.querySelector('#dkp-edit-player-btn')?.addEventListener('click', () => _editPlayer(container));
  container.querySelector('#dkp-delete-player-btn')?.addEventListener('click', () => _deletePlayer(container));

  // Role management
  container.querySelector('#dkp-role-add-btn')?.addEventListener('click', () => _addRole(container));
  container.querySelectorAll('.dkp-role-change').forEach(btn => {
    btn.addEventListener('click', async () => {
      const username = btn.dataset.roleUser;
      const newRole = btn.dataset.newRole;
      try {
        await api.post(DKP_API, { action: 'manage-roles', username, role: newRole });
        toast(`${username} als ${newRole === 'admin' ? 'Admin' : 'Offizier'} gesetzt`);
        await loadData();
      } catch (e) { toast('Fehler: ' + e.message); }
    });
  });
  container.querySelectorAll('.dkp-role-remove').forEach(btn => {
    btn.addEventListener('click', async () => {
      const username = btn.dataset.roleUser;
      try {
        await api.post(DKP_API, { action: 'manage-roles', username, role: null });
        toast(`Rolle von ${username} entfernt`);
        await loadData();
      } catch (e) { toast('Fehler: ' + e.message); }
    });
  });
}

function _renderOverview() {
  let html = '';
  const admin = _isDkpAdmin();
  const sorted = _sortedBalances();
  const transactions = getState('dkp.transactions') || [];
  const playerDetail = getState('ui.dkpPlayerDetail');
  const searchQuery = getState('ui.dkpSearchQuery') || '';
  const txFilter = getState('ui.dkpTxFilter') || 'all';
  const sortCol = getState('ui.dkpSortCol') || 'balance';
  const sortDir = getState('ui.dkpSortDir') || 'desc';

  // Toolbar
  html += `<div class="dkp-toolbar">
    <button class="dkp-toolbar-btn" id="dkp-csv">CSV Export</button>
    ${admin && transactions.length ? '<button class="dkp-toolbar-btn dkp-undo" id="dkp-undo">Rückgängig</button>' : ''}
  </div>`;

  // Player detail
  if (playerDetail) {
    return html + _renderPlayerDetail(playerDetail);
  }

  // Search
  html += `<div class="dkp-search"><input type="text" id="dkp-search-input" value="${h(searchQuery)}" placeholder="Spieler suchen\u2026"></div>`;

  const filtered = searchQuery ? sorted.filter(b =>
    b.playerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (b.className || '').toLowerCase().includes(searchQuery.toLowerCase())
  ) : sorted;

  // Standings
  html += `<div class="card"><div class="card-title">DKP-Übersicht${filtered.length !== sorted.length ? ` <span style="font-size:12px;color:var(--color-text-muted);font-weight:400">(${filtered.length} von ${sorted.length})</span>` : ''}</div>`;
  if (!sorted.length) {
    html += '<div class="empty">Noch keine DKP-Einträge.</div>';
  } else if (!filtered.length) {
    html += `<div class="empty">Keine Treffer für \u201E${h(searchQuery)}\u201C</div>`;
  } else {
    const sortArrow = c => sortCol === c ? (sortDir === 'asc' ? '\u25B2' : '\u25BC') : '';
    html += `<div style="overflow-x:auto"><table class="dkp-standings">
      <thead><tr>
        <th>#</th>
        <th data-dkp-sort="name" class="${sortCol === 'name' ? 'dkp-sort-active' : ''}">Spieler<span class="dkp-sort-arrow">${sortArrow('name')}</span></th>
        <th data-dkp-sort="class" class="${sortCol === 'class' ? 'dkp-sort-active' : ''}">Klasse<span class="dkp-sort-arrow">${sortArrow('class')}</span></th>
        <th data-dkp-sort="balance" style="text-align:right" class="${sortCol === 'balance' ? 'dkp-sort-active' : ''}">DKP<span class="dkp-sort-arrow">${sortArrow('balance')}</span></th>
      </tr></thead>
      <tbody>${filtered.map((b, i) => {
        const balCls = b.balance > 0 ? 'dkp-pos' : b.balance < 0 ? 'dkp-neg' : 'dkp-zero';
        return `<tr data-dkp-player="${h(b.playerName)}">
          <td class="dkp-rank">${i + 1}</td>
          <td style="font-weight:600;color:${cc(b.className)}">${h(b.playerName)}</td>
          <td style="font-size:12px;color:var(--color-text-muted)">${b.className ? h(b.className) : '\u2014'}</td>
          <td style="text-align:right"><span class="dkp-bal ${balCls}">${b.balance > 0 ? '+' : ''}${b.balance}</span></td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>`;
  }
  html += '</div>';

  // Transactions
  if (transactions.length) {
    const filteredTx = txFilter === 'all' ? transactions.slice(0, 20) : transactions.filter(t => t.type === txFilter).slice(0, 20);
    html += `<div class="card"><div class="card-title">Letzte Transaktionen</div>
      <div class="dkp-tx-filters">
        ${['all', 'earn', 'spend', 'decay', 'adjust'].map(f => {
          const labels = { all: 'Alle', earn: 'Verdient', spend: 'Beute', decay: 'Verfall', adjust: 'Anpassung' };
          return `<button class="dkp-tx-filter${txFilter === f ? ' active' : ''}" data-txfilter="${f}">${labels[f]}</button>`;
        }).join('')}
      </div>
      ${filteredTx.length ? _renderTxList(filteredTx) : '<div class="empty" style="padding:12px 0">Keine Transaktionen in dieser Kategorie</div>'}
    </div>`;
  }

  return html;
}

function _renderPlayerDetail(name) {
  const admin = _isDkpAdmin();
  const balances = getState('dkp.balances') || [];
  const transactions = getState('dkp.transactions') || [];
  const bal = balances.find(b => b.playerName === name);
  const txs = transactions.filter(t => t.playerName === name).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const earned = txs.filter(t => t.type === 'earn').reduce((s, t) => s + t.amount, 0);
  const spent = txs.filter(t => t.type === 'spend').reduce((s, t) => s + Math.abs(t.amount), 0);
  const decayed = txs.filter(t => t.type === 'decay').reduce((s, t) => s + Math.abs(t.amount), 0);

  const balance = bal?.balance || 0;
  const balCls = balance > 0 ? 'dkp-pos' : balance < 0 ? 'dkp-neg' : 'dkp-zero';

  let html = `<div class="dkp-player-detail card">
    <button class="btn-secondary dkp-detail-close" id="dkp-back" style="margin-bottom:var(--sp-4);font-size:12px;padding:6px 14px">\u2190 Zurück</button>
    <div class="dkp-detail-header">
      <div>
        <h3 class="dkp-detail-name" style="color:${cc(bal?.className)}">${h(name)}</h3>
        ${bal?.className ? `<div style="font-size:var(--text-sm);color:var(--color-text-muted)">${h(bal.className)}</div>` : ''}
      </div>
      <div class="dkp-detail-bal ${balCls}">${balance > 0 ? '+' : ''}${balance} DKP</div>
    </div>
    <div class="dkp-detail-stats">
      <div class="dkp-detail-stat"><div class="val" style="color:var(--green-400)">+${earned}</div><div class="lbl">Verdient</div></div>
      <div class="dkp-detail-stat"><div class="val" style="color:var(--red-400)">-${spent}</div><div class="lbl">Ausgegeben</div></div>
      <div class="dkp-detail-stat"><div class="val" style="color:var(--yellow-400)">-${decayed}</div><div class="lbl">Verfall</div></div>
    </div>
    <div class="dkp-bonus-status" style="font-size:12px;padding:var(--sp-2) 0;color:var(--color-text-muted)">Startbonus: ${bal?.hasReceivedStartingBonus ? '<span style="color:var(--green-400)">erhalten</span>' : '<span style="color:var(--yellow-400)">ausstehend</span>'}</div>`;

  // Admin actions
  if (admin) {
    html += `<div class="dkp-detail-actions">
      <button class="dkp-detail-action btn-p" id="dkp-adjust-btn" data-player="${h(name)}">DKP anpassen</button>
      <button class="dkp-detail-action btn-p" id="dkp-edit-player-btn" data-player="${h(name)}">Bearbeiten</button>
      <button class="dkp-detail-action danger btn-p" id="dkp-delete-player-btn" data-player="${h(name)}">Spieler löschen</button>
    </div>`;
  }

  html += `<div class="card-title">Transaktionen (${txs.length})</div>
    ${_renderTxList(txs)}
  </div>`;

  return html;
}

function _renderTxList(txs) {
  if (!txs.length) return '<div class="empty" style="padding:12px 0">Keine Transaktionen</div>';
  const admin = _isDkpAdmin();
  const typeLabels = { earn: 'Verdient', spend: 'Beute', decay: 'Verfall', adjust: 'Anpassung' };
  return txs.map(t => {
    const amtCls = t.amount >= 0 ? 'dkp-pos' : 'dkp-neg';
    return `<div class="dkp-tx">
      <span class="dkp-tx-type dkp-tx-${t.type}">${typeLabels[t.type] || t.type}</span>
      <span class="dkp-tx-player dkp-tx-name">${h(t.playerName)}</span>
      <span class="dkp-tx-amount ${amtCls}">${t.amount > 0 ? '+' : ''}${t.amount}</span>
      <span class="dkp-tx-reason">${t.reason ? linkItems(t.reason) : '\u2014'}</span>
      <span class="dkp-tx-time">${t.timestamp ? timeAgo(t.timestamp) : ''}</span>
      ${admin ? `<button class="dkp-tx-btn" data-tx-id="${t.id}" title="Bearbeiten">\u270F</button><button class="dkp-tx-btn dkp-tx-del" data-tx-id="${t.id}" title="Löschen">\u2715</button>` : ''}
    </div>`;
  }).join('');
}

function _renderAward() {
  const balances = getState('dkp.balances') || [];
  const entries = getState('entries') || [];
  const raids = getState('raids') || [];
  const selectedPlayers = getState('ui.dkpAwardPlayers') || [];
  const amount = getState('ui.dkpAwardAmount') || '';

  // Past raids for raid picker
  const now = new Date();
  const pastRaids = raids
    .filter(r => new Date(r.date + 'T' + (r.time || '20:00')) < now)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 20);

  // Combine unique player names
  const playerNames = new Set(balances.map(b => b.playerName));
  entries.forEach(e => playerNames.add(e.charName));
  const allPlayers = [...playerNames].sort();
  const allSelected = selectedPlayers.length === allPlayers.length && allPlayers.length > 0;

  // Preview calculation
  const amtNum = parseInt(amount) || 0;
  let previewHtml = '';
  if (selectedPlayers.length > 0 && amtNum > 0) {
    const total = selectedPlayers.length * amtNum;
    previewHtml = `<div style="font-size:var(--text-sm);color:var(--color-accent);margin:var(--sp-2) 0">${selectedPlayers.length} Spieler \u00D7 ${amtNum} DKP${selectedPlayers.length > 1 ? ` = ${total} DKP` : ''}</div>`;
  }

  return `<div class="card dkp-form">
    <div class="card-title">DKP vergeben</div>
    ${pastRaids.length ? `<div class="field">
      <span class="label">Raid auswählen (optional)</span>
      <select class="input" id="dkp-raid-picker">
        <option value="">— Spieler manuell wählen —</option>
        ${pastRaids.map(r => {
          const su = (r.signups || []).filter(s => s.status !== 'declined');
          return `<option value="${r.id}">${h(r.instance)} — ${formatDate(r.date)} (${su.length} Spieler)</option>`;
        }).join('')}
      </select>
    </div>` : ''}
    <div class="field">
      <span class="label">Spieler auswählen</span>
      <button class="btn-secondary dkp-selectall" style="font-size:11px;padding:4px 10px;margin-bottom:var(--sp-2)">${allSelected ? 'Keine auswählen' : 'Alle auswählen'}</button>
      <div class="dkp-player-select">
        ${allPlayers.map(name => `<button class="dkp-pchip dkp-player-chip${selectedPlayers.includes(name) ? ' active selected' : ''}" data-dkp-select-player="${h(name)}">${h(name)}</button>`).join('')}
      </div>
      <div style="font-size:11px;color:var(--color-text-muted);margin-top:var(--sp-2)">${selectedPlayers.length} ausgewählt</div>
    </div>
    <div class="field">
      <span class="label">Betrag</span>
      <input class="input" type="number" id="dkp-award-amount" value="${h(String(amount))}" placeholder="z.B. 10">
    </div>
    <div class="field">
      <span class="label">Grund</span>
      <input class="input" type="text" id="dkp-award-reason" value="${h(getState('ui.dkpAwardReason') || '')}" placeholder="z.B. Raid-Teilnahme">
    </div>
    ${previewHtml}
    <button class="btn-primary btn-p" id="dkp-award-submit" ${selectedPlayers.length === 0 || !amtNum ? 'disabled' : ''}>Vergeben</button>
  </div>`;
}

function _renderSpend() {
  const balances = getState('dkp.balances') || [];
  return `<div class="card dkp-form">
    <div class="card-title">Beute verteilen</div>
    <div class="field">
      <span class="label">Spieler</span>
      <select class="input" id="dkp-spend-player">
        <option value="">— Wählen —</option>
        ${balances.map(b => `<option value="${h(b.playerName)}">${h(b.playerName)} (${b.balance} DKP)</option>`).join('')}
      </select>
    </div>
    <div class="dkp-spend-max" style="display:none;font-size:12px;color:var(--yellow-400);padding:var(--sp-1) 0"></div>
    <div class="field">
      <span class="label">Kosten</span>
      <input class="input" type="number" id="dkp-spend-amount" placeholder="z.B. 25">
    </div>
    <div class="field">
      <span class="label">Item</span>
      <input class="input" type="text" id="dkp-spend-item" placeholder="z.B. [Zorn des Illidari]">
      <span class="label-sub">[Item] wird als Wowhead-Link dargestellt</span>
    </div>
    <button class="btn-primary btn-p" id="dkp-spend-submit" disabled>Beute verbuchen</button>
  </div>`;
}

function _renderDecay() {
  const balances = getState('dkp.balances') || [];
  const pct = getState('ui.dkpDecayPercent') || 15;
  const positive = balances.filter(b => b.balance > 0);

  return `<div class="card dkp-form">
    <div class="card-title">Wöchentlicher Verfall</div>
    <div class="field">
      <span class="label">Verfall-Prozent</span>
      <input class="input" type="number" id="dkp-decay-pct" value="${pct}" min="1" max="100">
    </div>
    <div class="dkp-decay-preview">
      <div class="card-title">Vorschau (${positive.length} Spieler betroffen)</div>
      ${positive.slice(0, 10).map(b => {
        const loss = Math.round(b.balance * pct / 100);
        return `<div class="dkp-decay-row">
          <span>${h(b.playerName)}</span>
          <span>${b.balance} \u2192 ${b.balance - loss} <span style="color:var(--red-400)">(-${loss})</span></span>
        </div>`;
      }).join('')}
      ${positive.length > 10 ? `<div style="font-size:11px;color:var(--color-text-muted);padding:var(--sp-2) 0">...und ${positive.length - 10} weitere</div>` : ''}
    </div>
    <button class="btn-primary btn-p" id="dkp-decay-submit" style="margin-top:var(--sp-4)">Verfall anwenden</button>
  </div>`;
}

function _renderSettings() {
  const config = getState('dkp.config') || {};
  const roles = config.roles || {};
  const roleEntries = Object.entries(roles).sort((a, b) => {
    if (a[1] === 'admin' && b[1] !== 'admin') return -1;
    if (a[1] !== 'admin' && b[1] === 'admin') return 1;
    return a[0].localeCompare(b[0]);
  });

  return `<div class="card dkp-form">
    <div class="card-title">DKP-Einstellungen</div>
    <div class="field">
      <span class="label">Standard-Verfall (%)</span>
      <input class="input" type="number" id="cfg-decay" value="${config.defaultDecayPercent || 15}">
    </div>
    <div class="field">
      <span class="label">Max. DKP pro Aktion</span>
      <input class="input" type="number" id="cfg-max" value="${config.maxDkpAmount || 10000}">
    </div>
    <div class="field">
      <span class="label">Start-DKP</span>
      <input class="input" type="number" id="cfg-start" value="${config.startingBalance || 0}">
    </div>
    <div class="field">
      <span class="label">Negative Salden erlauben</span>
      <input type="checkbox" id="cfg-neg" ${config.allowNegativeBalance ? 'checked' : ''}>
    </div>
    <div class="field">
      <span class="label">Transaktionslimit pro Spieler</span>
      <input class="input" type="number" id="cfg-tx-limit" value="${config.transactionLimit || 0}" placeholder="0 = unbegrenzt">
    </div>
    <div class="field">
      <span class="label">Max. Zeichenlänge Grund</span>
      <input class="input" type="number" id="cfg-reason-max" value="${config.reasonMaxLength || 200}" placeholder="200">
    </div>
    <button class="btn-primary btn-p" id="dkp-cfg-save">Speichern</button>

    <div class="card-title" style="margin-top:var(--sp-6)">Raid-DKP Regeln</div>
    <div class="field">
      <span class="label">Mindestgebot (DKP)</span>
      <input class="input" type="number" id="cfg-min-bid" value="${config.minBid || 5}" min="1" max="1000">
    </div>
    <div class="field">
      <span class="label">Raidteilnahme DKP (vollständig)</span>
      <input class="input" type="number" id="cfg-raid-attendance" value="${config.raidAttendanceDkp || 10}" min="0" max="1000">
    </div>
    <div class="field">
      <span class="label">Raidteilnahme DKP (teilweise)</span>
      <input class="input" type="number" id="cfg-raid-partial" value="${config.raidPartialDkp || 5}" min="0" max="1000">
    </div>
    <div class="field">
      <span class="label">Bench DKP</span>
      <input class="input" type="number" id="cfg-raid-bench" value="${config.raidBenchDkp || 10}" min="0" max="1000">
    </div>
    <div class="field">
      <span class="label">Bosskill DKP</span>
      <input class="input" type="number" id="cfg-boss-kill" value="${config.bossKillDkp || 5}" min="0" max="1000">
    </div>
    <div class="field">
      <span class="label">Startbonus (einmalig)</span>
      <input class="input" type="number" id="cfg-starting-bonus" value="${config.startingBonus || 20}" min="0" max="10000">
    </div>
    <button class="btn-primary btn-p" id="dkp-cfg-save-2" style="margin-top:var(--sp-2)">Speichern</button>

    <div class="card-title" style="margin-top:var(--sp-6)">Rollenverwaltung</div>
    <div class="dkp-role-list">
      ${roleEntries.map(([u, r]) => `<div class="dkp-role-entry">
        <span>${h(u)}</span>
        <span class="dkp-role-badge">${r === 'admin' ? 'Admin' : 'Offizier'}</span>
        <div style="display:flex;gap:var(--sp-1)">
          ${r === 'officer' ? `<button class="btn-secondary dkp-role-change" data-role-user="${h(u)}" data-new-role="admin" style="font-size:10px;padding:2px 6px">\u2191 Admin</button>` : `<button class="btn-secondary dkp-role-change" data-role-user="${h(u)}" data-new-role="officer" style="font-size:10px;padding:2px 6px">\u2193 Offizier</button>`}
          <button class="btn-danger dkp-role-remove" data-role-user="${h(u)}" style="font-size:10px;padding:2px 6px">\u2715</button>
        </div>
      </div>`).join('')}
      ${!roleEntries.length ? '<div class="empty" style="padding:8px 0">Keine Rollen vergeben</div>' : ''}
    </div>
    <div class="dkp-role-add" style="display:flex;gap:var(--sp-2);margin-top:var(--sp-2)">
      <input class="input" type="text" id="dkp-role-user" placeholder="Benutzername" style="flex:1">
      <select class="input" id="dkp-role-type" style="width:auto">
        <option value="officer">Offizier</option>
        <option value="admin">Admin</option>
      </select>
      <button class="btn-primary btn-p" id="dkp-role-add-btn">Hinzufügen</button>
    </div>
  </div>`;
}

async function _doAward(container) {
  const selectedNames = getState('ui.dkpAwardPlayers') || [];
  const amount = parseInt(container.querySelector('#dkp-award-amount')?.value) || 0;
  const reason = container.querySelector('#dkp-award-reason')?.value || '';
  if (!selectedNames.length || !amount) { toast('Spieler und Betrag erforderlich'); return; }
  const balances = getState('dkp.balances') || [];
  const entries = getState('entries') || [];
  const players = selectedNames.map(name => {
    const entry = entries.find(e => e.charName === name);
    const bal = balances.find(b => b.playerName === name);
    return { name, className: entry?.className || bal?.className || '' };
  });
  try {
    await api.post(DKP_API, { action: 'award', players, amount, reason });
    toast(`${amount} DKP an ${players.length} Spieler vergeben`);
    update('ui.dkpAwardPlayers', []);
    update('ui.dkpAwardAmount', '');
    update('ui.dkpAwardReason', '');
    update('ui.dkpView', 'overview');
    await loadData();
  } catch (e) { toast('Fehler: ' + e.message); }
}

async function _doSpend(container) {
  const player = container.querySelector('#dkp-spend-player')?.value;
  const amount = parseInt(container.querySelector('#dkp-spend-amount')?.value) || 0;
  const item = container.querySelector('#dkp-spend-item')?.value || '';
  if (!player || !amount) { toast('Spieler und Kosten erforderlich'); return; }
  try {
    await api.post(DKP_API, { action: 'spend', playerName: player, amount, reason: item });
    toast(`${amount} DKP für Beute abgezogen`);
    update('ui.dkpView', 'overview');
    await loadData();
  } catch (e) { toast('Fehler: ' + e.message); }
}

async function _doDecay(container) {
  const pct = parseInt(container.querySelector('#dkp-decay-pct')?.value) || 15;
  showConfirm('Verfall anwenden', `<strong>${pct}%</strong> DKP-Verfall auf alle positiven Salden anwenden?`, async () => {
    try {
      await api.post(DKP_API, { action: 'decay', percent: pct });
      toast(`${pct}% Verfall angewendet`);
      update('ui.dkpView', 'overview');
      await loadData();
    } catch (e) { toast('Fehler: ' + e.message); }
  });
}

async function _doSaveConfig(container) {
  const config = {
    action: 'save-config',
    defaultDecayPercent: parseInt(container.querySelector('#cfg-decay')?.value) || 15,
    maxDkpAmount: parseInt(container.querySelector('#cfg-max')?.value) || 10000,
    startingBalance: parseInt(container.querySelector('#cfg-start')?.value) || 0,
    allowNegativeBalance: container.querySelector('#cfg-neg')?.checked || false,
    transactionLimit: parseInt(container.querySelector('#cfg-tx-limit')?.value) || 0,
    reasonMaxLength: parseInt(container.querySelector('#cfg-reason-max')?.value) || 200,
    minBid: parseInt(container.querySelector('#cfg-min-bid')?.value) || 5,
    raidAttendanceDkp: parseInt(container.querySelector('#cfg-raid-attendance')?.value) || 10,
    raidPartialDkp: parseInt(container.querySelector('#cfg-raid-partial')?.value) || 5,
    raidBenchDkp: parseInt(container.querySelector('#cfg-raid-bench')?.value) || 10,
    bossKillDkp: parseInt(container.querySelector('#cfg-boss-kill')?.value) || 5,
    startingBonus: parseInt(container.querySelector('#cfg-starting-bonus')?.value) || 20,
  };
  try {
    await api.post(DKP_API, config);
    toast('Einstellungen gespeichert');
    await loadData();
  } catch (e) { toast('Fehler: ' + e.message); }
}

async function _doUndo(container) {
  const transactions = getState('dkp.transactions') || [];
  const last = transactions[transactions.length - 1];
  const detail = last ? `<strong>${h(last.playerName)}</strong>: ${last.amount > 0 ? '+' : ''}${last.amount} DKP` : '';
  showConfirm('Letzte Aktion rückgängig machen', `Die letzte DKP-Transaktion wird rückgängig gemacht.${detail ? '<br>' + detail : ''}`, async () => {
    try {
      await api.post(DKP_API, { action: 'undo', transactionId: last?.id });
      toast('Letzte Aktion rückgängig gemacht');
      await loadData();
    } catch (e) { toast('Fehler: ' + e.message); }
  });
}

function _editTransaction(container, txId) {
  const transactions = getState('dkp.transactions') || [];
  const tx = transactions.find(t => t.id === txId);
  if (!tx) return;

  showModal({
    title: 'Transaktion bearbeiten',
    body: `<div class="field"><span class="label">Betrag</span><input class="input" type="number" id="dkp-edit-amount" value="${Math.abs(tx.amount)}"></div>
      <div class="field"><span class="label">Grund</span><input class="input" type="text" id="dkp-edit-reason" value="${h(tx.reason || '')}"></div>`,
    confirmText: 'Speichern',
    onConfirm: async () => {
      const amount = parseInt(document.querySelector('#dkp-edit-amount')?.value) || 0;
      const reason = document.querySelector('#dkp-edit-reason')?.value || '';
      try {
        await api.post(DKP_API, { action: 'edit-transaction', transactionId: txId, amount: tx.amount >= 0 ? amount : -amount, reason });
        toast('Transaktion aktualisiert');
        await loadData();
      } catch (e) { toast('Fehler: ' + e.message); }
    },
  });
}

function _deleteTransaction(container, txId) {
  const transactions = getState('dkp.transactions') || [];
  const tx = transactions.find(t => t.id === txId);
  if (!tx) return;

  showConfirm('Transaktion löschen', `Transaktion für <strong>${h(tx.playerName)}</strong> (${tx.amount > 0 ? '+' : ''}${tx.amount} DKP) wirklich löschen?`, async () => {
    try {
      await api.post(DKP_API, { action: 'delete-transaction', transactionId: txId });
      toast('Transaktion gelöscht');
      await loadData();
    } catch (e) { toast('Fehler: ' + e.message); }
  });
}

function _adjustBalance(container) {
  const name = container.querySelector('#dkp-adjust-btn')?.dataset.player;
  if (!name) return;

  showModal({
    title: 'DKP anpassen',
    body: `<div class="field"><span class="label">Neuer Saldo</span><input class="input" type="number" id="dkp-adj-balance" value=""></div>
      <div class="field"><span class="label">Grund</span><input class="input" type="text" id="dkp-adj-reason" value="" placeholder="z.B. Korrektur"></div>`,
    confirmText: 'Anpassen',
    onConfirm: async () => {
      const balance = parseInt(document.querySelector('#dkp-adj-balance')?.value);
      const reason = document.querySelector('#dkp-adj-reason')?.value || '';
      if (isNaN(balance)) { toast('Saldo erforderlich'); return; }
      try {
        await api.post(DKP_API, { action: 'adjust-balance', playerName: name, newBalance: balance, reason });
        toast(`DKP von ${name} auf ${balance} angepasst`);
        await loadData();
      } catch (e) { toast('Fehler: ' + e.message); }
    },
  });
}

function _editPlayer(container) {
  const name = container.querySelector('#dkp-edit-player-btn')?.dataset.player;
  if (!name) return;
  const balances = getState('dkp.balances') || [];
  const bal = balances.find(b => b.playerName === name);

  showModal({
    title: 'Spieler bearbeiten',
    body: `<div class="field"><span class="label">Name</span>
      <input class="input" type="text" id="dkp-edit-name" value="${h(name)}" placeholder="Neuer Name"></div>
      <div class="field"><span class="label">Klasse</span>
      <select class="input" id="dkp-edit-class">
        <option value="">— Keine —</option>
        ${CLS.map(c => `<option value="${h(c.n)}"${bal?.className === c.n ? ' selected' : ''}>${h(c.n)}</option>`).join('')}
      </select></div>`,
    confirmText: 'Speichern',
    onConfirm: async () => {
      const newName = document.querySelector('#dkp-edit-name')?.value?.trim() || name;
      const className = document.querySelector('#dkp-edit-class')?.value || '';
      try {
        await api.post(DKP_API, { action: 'edit-player', playerName: name, newName: newName !== name ? newName : undefined, className });
        toast(`${name} aktualisiert`);
        if (newName !== name) update('ui.dkpPlayerDetail', newName);
        await loadData();
      } catch (e) { toast('Fehler: ' + e.message); }
    },
  });
}

function _deletePlayer(container) {
  const name = container.querySelector('#dkp-delete-player-btn')?.dataset.player;
  if (!name) return;

  showModal({
    title: 'Spieler löschen',
    body: `<p><strong>${h(name)}</strong> aus dem DKP-System entfernen?</p>
      <div class="field" style="margin-top:var(--sp-3)">
        <label style="display:flex;align-items:center;gap:var(--sp-2);font-size:var(--text-sm);cursor:pointer">
          <input type="checkbox" id="dkp-delete-txs" checked>
          Transaktionen auch löschen
        </label>
      </div>`,
    confirmText: 'Löschen',
    confirmClass: 'btn-danger',
    onConfirm: async () => {
      const deleteTxs = document.querySelector('#dkp-delete-txs')?.checked ?? true;
      try {
        await api.post(DKP_API, { action: 'delete-player', playerName: name, deleteTransactions: deleteTxs });
        toast(`${name} aus dem DKP-System entfernt`);
        update('ui.dkpPlayerDetail', null);
        await loadData();
      } catch (e) { toast('Fehler: ' + e.message); }
    },
  });
}

async function _addRole(container) {
  const username = container.querySelector('#dkp-role-user')?.value?.trim();
  const role = container.querySelector('#dkp-role-type')?.value || 'officer';
  if (!username) { toast('Benutzername erforderlich'); return; }
  try {
    await api.post(DKP_API, { action: 'manage-roles', username: username.toLowerCase(), role });
    toast(`${username} als ${role === 'admin' ? 'Admin' : 'Offizier'} hinzugefügt`);
    await loadData();
  } catch (e) { toast('Fehler: ' + e.message); }
}

function _exportDkpCsv() {
  const balances = _sortedBalances();
  const transactions = getState('dkp.transactions') || [];

  // Balances CSV
  const header = ['Spieler', 'Klasse', 'DKP'];
  const rows = balances.map(b => [b.playerName, b.className || '', b.balance]);

  // Add transaction history section
  const txHeader = ['', '', ''];
  const txTitleRow = ['Transaktionshistorie', '', ''];
  const txColHeader = ['Spieler', 'Typ', 'Betrag', 'Grund', 'Datum'];
  const txRows = transactions.map(t => [
    t.playerName,
    { earn: 'Verdient', spend: 'Beute', decay: 'Verfall', adjust: 'Anpassung' }[t.type] || t.type,
    t.amount,
    t.reason || '',
    t.timestamp ? new Date(t.timestamp).toLocaleString('de-DE') : '',
  ]);

  const allRows = [header, ...rows, txHeader, txTitleRow, txColHeader, ...txRows];
  const csv = allRows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'dkp-uebersicht.csv';
  a.click();
  URL.revokeObjectURL(url);
  toast('DKP CSV exportiert');
}
