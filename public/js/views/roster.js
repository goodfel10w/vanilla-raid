// ── Roster View (Aufstellung) ──

import { getState, update, subscribe } from '../state.js';
import { api, ENTRIES_API } from '../api.js';
import { h, cc, clsIcon, specIcon, specRole, collapseRanges } from '../utils.js';
import { CLS, ROLES, ROLE_ICONS, ROLE_COLORS, DAY_SHORT, DAYS, SLOTS } from '../constants.js';
import { showConfirm } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { navigate } from '../router.js';
import { loadData } from '../app.js';
import { isAdminUser } from '../auth.js';

let _unsub = [];

export function render(container) {
  _unsub.forEach(u => u());
  _unsub = [];
  _renderRoster(container);
  _unsub.push(subscribe('entries', () => _renderRoster(container)));
}

export function unmount() {
  _unsub.forEach(u => u());
  _unsub = [];
}

function _renderRoster(container) {
  const entries = getState('entries') || [];
  const user = getState('auth.user');
  const rosterSort = getState('ui.rosterSort') || 'name';

  // Role summary
  const rc = ROLES.map(r => {
    const members = entries.filter(e => (e.roles || []).includes(r));
    const classCounts = {};
    members.forEach(e => { classCounts[e.className] = (classCounts[e.className] || 0) + 1; });
    const classes = Object.entries(classCounts).sort((a, b) => b[1] - a[1]).map(([cn, ct]) => ({ name: cn, count: ct, color: cc(cn) }));
    return { r, c: members.length, classes };
  });

  let html = `<div class="rsumm">${rc.map(({ r, c, classes }) => {
    const clsHtml = classes.length
      ? classes.map(cl => `<div class="rcls-row"><span class="rcls-dot" style="background:${cl.color}"></span><span class="rcls-name" style="color:${cl.color}">${h(cl.name)}</span><span class="rcls-ct">${cl.count}</span></div>`).join('')
      : '<div class="rcls-empty">\u2014</div>';
    return `<div class="card rcard"><div class="ico">${ROLE_ICONS[r]}</div><div class="num" style="color:${ROLE_COLORS[r]}">${c}</div><div class="rl">${r}</div><div class="rcls-list">${clsHtml}</div></div>`;
  }).join('')}</div>`;

  if (entries.length) {
    html += `<div style="margin-bottom:var(--sp-4)"><button class="btn-export" id="btn-csv-export">\u{1F4BE} CSV Export</button></div>`;
  }

  // Unclaimed entry hint
  if (user && entries.length && !entries.some(e => e.userId === user.userId)) {
    const unclaimed = entries.filter(e => !e.userId);
    if (unclaimed.length) {
      html += `<div class="card" style="border:1px solid var(--color-border-accent);padding:12px 16px;margin-bottom:var(--sp-4);font-size:var(--text-sm);color:var(--color-text-muted)">
        \u{1F4CC} Du hast noch keinen Charakter mit deinem Account verknüpft. Klicke bei deinem Eintrag auf <strong style="color:var(--color-text-primary)">Bearbeiten</strong> und speichere ihn \u2014 dann gehört er dir.</div>`;
    }
  }

  if (!entries.length) {
    html += '<div class="empty">Noch keine Einträge. Sei der Erste!</div>';
    container.innerHTML = html;
    return;
  }

  // Sort controls
  html += `<div class="sort-bar">Sortieren:
    <select class="sort-sel" id="roster-sort">
      <option value="name"${rosterSort === 'name' ? ' selected' : ''}>Name</option>
      <option value="class"${rosterSort === 'class' ? ' selected' : ''}>Klasse</option>
      <option value="role"${rosterSort === 'role' ? ' selected' : ''}>Rolle</option>
    </select>
  </div>`;

  // Sort entries
  const sortedEntries = [...entries].sort((a, b) => {
    if (rosterSort === 'class') {
      const ci = CLS.findIndex(c => c.n === a.className) - CLS.findIndex(c => c.n === b.className);
      return ci || a.charName.localeCompare(b.charName);
    }
    if (rosterSort === 'role') {
      const ra = (a.roles || [])[0] || '';
      const rb = (b.roles || [])[0] || '';
      return ROLES.indexOf(ra) - ROLES.indexOf(rb) || a.charName.localeCompare(b.charName);
    }
    return a.charName.localeCompare(b.charName);
  });

  sortedEntries.forEach(e => {
    const roles = (e.roles || [e.role].filter(Boolean)).filter(r => ROLES.includes(r));
    const slotTags = DAYS.flatMap(d => collapseRanges(e.availability || {}, d).map(r => {
      const isTent = r.type === 'tentative';
      return `<span class="stag${isTent ? ' tent' : ''}">${isTent ? '? ' : ''}${DAY_SHORT[d]} ${r.start}\u2013${r.end}</span>`;
    }));
    const canEdit = user && (isAdminUser() || !e.userId || e.userId === user.userId);
    html += `<div class="entry" data-testid="roster-entry">
      <div class="e-info">
        <div class="e-name" style="color:${cc(e.className)}"><img class="wow-ico-sm" src="${clsIcon(e.className)}" alt="" loading="lazy">${h(e.charName)}</div>
        <div class="e-class">${h(e.className)}</div>
        <div class="e-roles">${e.specs && e.specs.length
          ? e.specs.map(s => {
            const r = specRole(e.className, s);
            const ico = specIcon(e.className, s);
            return `<span class="rbadge" style="background:${ROLE_COLORS[r]}18;color:${ROLE_COLORS[r]}">${ico ? `<img class="wow-ico-sm" src="${ico}" alt="">` : ROLE_ICONS[r]} ${s}</span>`;
          }).join('')
          : roles.map(r => `<span class="rbadge" style="background:${ROLE_COLORS[r]}18;color:${ROLE_COLORS[r]}">${ROLE_ICONS[r]} ${r}</span>`).join('')
        }</div>
      </div>
      <div class="e-slots">${slotTags.length ? slotTags.join('') : '<span style="font-size:11px;color:var(--gray-800)">Keine Zeiten</span>'}</div>
      ${e.notes ? `<div class="e-notes">\u201E${h(e.notes)}\u201C</div>` : ''}
      ${canEdit ? `<div class="e-actions">
        <button class="btn-edit" data-edit="${h(e.id)}" data-testid="entry-edit">Bearbeiten</button>
        <button class="btn-del" data-del="${h(e.id)}" data-testid="entry-delete" aria-label="Eintrag von ${h(e.charName)} löschen">\u2715</button>
      </div>` : ''}
    </div>`;
  });

  container.innerHTML = html;

  // Events
  container.querySelector('#roster-sort')?.addEventListener('change', function () {
    update('ui.rosterSort', this.value);
    _renderRoster(container);
  });

  container.querySelector('#btn-csv-export')?.addEventListener('click', _exportCSV);

  // Edit/delete delegation
  container.addEventListener('click', e => {
    const editBtn = e.target.closest('[data-edit]');
    if (editBtn) {
      import('./form.js').then(mod => {
        mod.startEdit(editBtn.dataset.edit);
      });
      return;
    }
    const delBtn = e.target.closest('[data-del]');
    if (delBtn) {
      _deleteEntry(delBtn.dataset.del);
    }
  });
}

async function _deleteEntry(id) {
  const entries = getState('entries') || [];
  const e = entries.find(x => x.id === id);
  const name = e ? e.charName : 'diesen Eintrag';
  showConfirm('Eintrag löschen', `Soll der Eintrag von <strong>${h(name)}</strong> wirklich gelöscht werden?`, async () => {
    try {
      await api.del(ENTRIES_API + '?id=' + encodeURIComponent(id));
      toast('Gelöscht');
      await loadData();
    } catch (err) {
      if (err.message === 'Keine Berechtigung') {
        toast('Du kannst nur eigene Einträge löschen');
      } else {
        toast('Fehler beim Löschen');
      }
    }
  });
}

function _exportCSV() {
  const entries = getState('entries') || [];
  const header = ['Charakter', 'Klasse', 'Rollen', ...DAYS.map(d => DAY_SHORT[d]), 'Anmerkungen'];
  const rows = entries.map(e => {
    const roles = (e.roles || []).join('/');
    const dayCols = DAYS.map(d => {
      const ranges = collapseRanges(e.availability || {}, d);
      if (!ranges.length) return '\u2014';
      return ranges.map(r => (r.type === 'tentative' ? '? ' : '') + r.start + '\u2013' + r.end).join(', ');
    });
    return [e.charName, e.className, roles, ...dayCols, e.notes || ''];
  });

  const csv = [header, ...rows].map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'raider-aufstellung.csv';
  a.click();
  URL.revokeObjectURL(url);
  toast('CSV exportiert');
}
