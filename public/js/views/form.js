// ── Form View (Eintragen) ──

import { getState, update, subscribe } from '../state.js';
import { api, ENTRIES_API } from '../api.js';
import { h, specsToRoles, specRole, inferSpecs, migrateLegacyAvail } from '../utils.js';
import { CLS, CLASS_SPECS, ROLE_COLORS, WOW_ICONS, BNET_ICON } from '../constants.js';
import { timelineGrid, attachTimelinePaint } from '../components/timeline-grid.js';
import { toast } from '../components/toast.js';
import { navigate } from '../router.js';
import { doBnetLogin } from '../auth.js';
import { loadData } from '../app.js';

let _unsub = [];
let _container = null;

export function render(container) {
  _container = container;
  _unsub.forEach(u => u());
  _unsub = [];
  _renderForm(container);
  _unsub.push(subscribe('auth.user', () => _renderForm(container)));
  _unsub.push(subscribe('auth.bnetCharacters', () => _renderForm(container)));
}

export function unmount() {
  _unsub.forEach(u => u());
  _unsub = [];
  _container = null;
}

function _syncInputs() {
  if (!_container) return;
  const form = getState('ui.form');
  const nameEl = _container.querySelector('#f-name');
  if (nameEl) form.name = nameEl.value;
  const notesEl = _container.querySelector('#f-notes');
  if (notesEl) form.notes = notesEl.value;
}

function _renderForm(container, skipSync) {
  if (!skipSync) _syncInputs();
  const user = getState('auth.user');
  const form = getState('ui.form');
  const editId = getState('ui.editId');
  const bnetChars = getState('auth.bnetCharacters') || [];

  if (!user) {
    container.innerHTML = `<div class="auth-hint" style="text-align:center;padding:var(--sp-12) var(--sp-5)">
      <div style="color:var(--color-text-muted);font-size:var(--text-sm);margin-bottom:var(--sp-4)">Bitte melde dich an, um einen Eintrag zu erstellen.</div>
      <button class="btn-bnet" data-action="bnet-login">${BNET_ICON} Mit Battle.net anmelden</button>
    </div>`;
    return;
  }

  form.roles = specsToRoles(form.cls, form.specs);
  const canSave = form.name.trim() && form.cls && form.specs.length > 0;

  // Character picker
  let charPickerHtml = '';
  if (bnetChars.length > 0 && !editId) {
    charPickerHtml = `<div class="field char-picker">
      <span class="label">Charakter importieren</span>
      <span class="label-sub">Wähle einen Charakter aus deinem Battle.net-Konto</span>
      <select class="input" id="f-char-pick">
        <option value="">— Manuell eingeben —</option>
        ${bnetChars.map((c, i) => `<option value="${i}">${h(c.name)} — ${h(c.className)} (${h(c.realm)}, Lv.${c.level})</option>`).join('')}
      </select>
    </div>`;
  }

  // Spec chips
  let specHtml = '';
  if (form.cls) {
    specHtml = `<div class="rchips" role="group" aria-label="Specs">
      ${(CLASS_SPECS[form.cls] || []).map(sp => {
        const on = form.specs.includes(sp.n);
        const col = ROLE_COLORS[sp.r];
        return `<div class="rchip${on ? ' active' : ''}" role="checkbox" aria-checked="${on}" tabindex="0"
          style="${on ? `border-color:${col};color:${col};background:${col}18` : ''}"
          data-spec="${sp.n}">
          <img class="wow-ico" src="${WOW_ICONS}/spec/${sp.i}.png" alt="" loading="lazy">
          ${sp.n}
          <span style="font-size:10px;opacity:.7">${sp.r}</span>
        </div>`;
      }).join('')}
    </div>`;
  } else {
    specHtml = '<div style="font-size:12px;color:var(--color-text-muted)">Wähle zuerst eine Klasse</div>';
  }

  // Validation message
  let validationMsg = '';
  if (!canSave) {
    const missing = [
      !form.name.trim() && 'Charaktername',
      !form.cls && 'Klasse',
      !form.specs.length && 'Spezialisierung',
    ].filter(Boolean);
    validationMsg = `<div style="font-size:12px;color:var(--color-error);margin-bottom:8px">Bitte ausfüllen: ${missing.join(', ')}</div>`;
  }

  // Submit summary
  let summaryHtml = '';
  if (canSave) {
    summaryHtml = `<div class="submit-summary">
      ${form.specs.map(s => {
        const r = specRole(form.cls, s);
        return `<span class="rbadge" style="background:${ROLE_COLORS[r]}18;color:${ROLE_COLORS[r]}">${s} (${r})</span>`;
      }).join('')}
    </div>`;
  }

  container.innerHTML = `
    <div class="card" style="padding:28px">
      ${charPickerHtml}
      <div class="field">
        <span class="label">Charaktername</span>
        <input class="input" type="text" id="f-name" data-testid="form-name" value="${h(form.name)}" placeholder="z.B. Thrallmächtig">
      </div>
      <div class="field">
        <span class="label">Klasse</span>
        <div class="chips" role="radiogroup" aria-label="Klasse">
          ${CLS.map(c => `<div class="chip${form.cls === c.n ? ' active' : ''}" role="radio" aria-checked="${form.cls === c.n}" tabindex="0"
            style="${form.cls === c.n ? `border-color:${c.c};color:${c.c};background:${c.c}18` : ''}"
            data-cls="${c.n}">
            <img class="wow-ico" src="${WOW_ICONS}/class/64/${c.i}.png" alt="" loading="lazy">${c.n}
          </div>`).join('')}
        </div>
      </div>
      <div class="field">
        <span class="label">Spezialisierung(en)</span>
        <span class="label-sub">Wähle alle Specs, die du spielen kannst</span>
        ${specHtml}
      </div>
      <div class="field">
        <span class="label">Verfügbarkeit</span>
        <span class="label-sub">Klick: Ja \u2713 \u2192 Vielleicht ? \u2192 Aus \u00B7 Ziehen für Bereiche</span>
        ${timelineGrid(form.avail)}
      </div>
      <div class="field">
        <span class="label">Anmerkungen (optional)</span>
        <input class="input" type="text" id="f-notes" data-testid="form-notes" value="${h(form.notes)}" placeholder="z.B. Erste Woche im Monat nicht verfügbar">
      </div>
      ${validationMsg}
      ${summaryHtml}
      <div class="btn-row">
        <button class="btn-primary" id="f-submit" data-testid="form-submit" ${canSave ? '' : 'disabled'}>${editId ? 'Aktualisieren' : 'Eintragen'}</button>
        ${editId ? '<button class="btn-secondary" id="f-cancel">Abbrechen</button>' : ''}
      </div>
    </div>`;

  // Attach events
  _attachEvents(container, form, editId);
}

function _attachEvents(container, form, editId) {
  // Character picker
  const charPick = container.querySelector('#f-char-pick');
  if (charPick) {
    charPick.addEventListener('change', () => {
      const idx = charPick.value;
      if (idx === '') {
        form.name = ''; form.cls = ''; form.specs = []; form.roles = [];
      } else {
        const chars = getState('auth.bnetCharacters') || [];
        const c = chars[parseInt(idx)];
        if (c) { form.name = c.name; form.cls = c.className; form.specs = []; form.roles = []; }
      }
      _renderForm(container, true);
    });
  }

  // Name input
  const nameInput = container.querySelector('#f-name');
  if (nameInput) {
    nameInput.addEventListener('input', () => { form.name = nameInput.value; _updateSubmitBtn(container); });
  }

  // Class chips
  container.querySelectorAll('[data-cls]').forEach(chip => {
    const handler = () => {
      form.cls = chip.dataset.cls;
      form.specs = [];
      form.roles = [];
      _renderForm(container);
    };
    chip.addEventListener('click', handler);
    chip.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handler(); } });
  });

  // Spec chips
  container.querySelectorAll('[data-spec]').forEach(chip => {
    const handler = () => {
      const s = chip.dataset.spec;
      if (form.specs.includes(s)) form.specs = form.specs.filter(x => x !== s);
      else form.specs = [...form.specs, s];
      form.roles = specsToRoles(form.cls, form.specs);
      _renderForm(container);
    };
    chip.addEventListener('click', handler);
    chip.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handler(); } });
  });

  // Timeline drag-to-paint
  attachTimelinePaint(container, form.avail);

  // Submit
  const submitBtn = container.querySelector('#f-submit');
  if (submitBtn) {
    submitBtn.addEventListener('click', () => _submitForm(container, form, editId));
  }

  // Cancel edit
  const cancelBtn = container.querySelector('#f-cancel');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      update('ui.editId', null);
      update('ui.form', { name: '', cls: '', specs: [], roles: [], avail: {}, notes: '' });
      _renderForm(container);
    });
  }
}

function _updateSubmitBtn(container) {
  const form = getState('ui.form');
  const btn = container.querySelector('#f-submit');
  if (btn) btn.disabled = !(form.name.trim() && form.cls && form.specs.length > 0);
}

async function _submitForm(container, form, editId) {
  const btn = container.querySelector('#f-submit');
  if (btn) { btn.disabled = true; btn.textContent = 'Speichern...'; }
  try {
    await api.post(ENTRIES_API, {
      id: editId || undefined,
      charName: form.name,
      className: form.cls,
      specs: form.specs,
      roles: specsToRoles(form.cls, form.specs),
      availability: form.avail,
      notes: form.notes,
    });
    toast(editId ? 'Eintrag aktualisiert \u2713' : 'Eintrag gespeichert \u2713');
    update('ui.editId', null);
    update('ui.form', { name: '', cls: '', specs: [], roles: [], avail: {}, notes: '' });
    await loadData();
    navigate('/roster');
  } catch (e) {
    if (e.message === 'Keine Berechtigung') {
      toast('Du kannst nur eigene Einträge bearbeiten');
    } else {
      toast('Fehler: ' + e.message);
    }
    if (btn) { btn.disabled = false; btn.textContent = editId ? 'Aktualisieren' : 'Eintragen'; }
  }
}

/** Start editing an entry (called from roster) */
export function startEdit(id) {
  const entries = getState('entries') || [];
  const e = entries.find(x => x.id === id);
  if (!e) return;
  const oldRoles = e.roles || [e.role].filter(Boolean);
  const specs = e.specs && e.specs.length ? e.specs : inferSpecs(e.className, oldRoles);
  update('ui.editId', id);
  update('ui.form', {
    name: e.charName,
    cls: e.className,
    specs: specs,
    roles: specsToRoles(e.className, specs),
    avail: migrateLegacyAvail(e.availability),
    notes: e.notes || '',
  });
  navigate('/form');
}
