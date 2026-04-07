<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useEntriesStore } from '@/stores/entries'
import { useRaidsStore } from '@/stores/raids'
import { useFormSubmit } from '@/composables/useFormSubmit'
import { useBnetCharPicker } from '@/composables/useBnetCharPicker'
import { specsToRoles, migrateLegacyAvail, cc } from '@/lib/utils'
import { CLASS_SPECS, ROLE_COLORS } from '@/lib/constants'
import ClassChipSelector from '@/components/shared/ClassChipSelector.vue'
import SpecChipSelector from '@/components/shared/SpecChipSelector.vue'
import AvailabilityGrid from '@/components/shared/AvailabilityGrid.vue'
import ClassIcon from '@/components/shared/ClassIcon.vue'
import ConfirmModal from '@/components/shared/ConfirmModal.vue'
import type { AvailabilityMap } from '@/types'

const route = useRoute()
const auth = useAuthStore()
const entriesStore = useEntriesStore()
const raidsStore = useRaidsStore()
const { submit } = useFormSubmit()
const { characters, hasCharacters, pickCharacter } = useBnetCharPicker()

// Form state
const name = ref('')
const cls = ref<string | null>(null)
const specs = ref<string[]>([])
const avail = ref<AvailabilityMap>({})
const notes = ref('')
const editId = ref<string | null>(null)
const creatingNew = ref(false)
const submitting = ref(false)

// Delete state
const deleteTarget = ref<string | null>(null)
const showDeleteConfirm = ref(false)
const deleting = ref(false)

// UI mode: 'cards' | 'form'
const mode = computed(() => {
  if (editId.value || creatingNew.value) return 'form'
  return 'cards'
})

const canSave = computed(() => {
  return !!(name.value.trim() && cls.value && specs.value.length > 0)
})

const missingFields = computed(() => {
  const missing: string[] = []
  if (!name.value.trim()) missing.push('Charaktername')
  if (!cls.value) missing.push('Klasse')
  if (!specs.value.length) missing.push('Spezialisierung')
  return missing
})

const isEditing = computed(() => !!editId.value)

const submitLabel = computed(() => {
  if (submitting.value) return 'Speichern...'
  return editId.value ? 'Aktualisieren' : 'Speichern'
})

const showCharPicker = computed(() => {
  return auth.isLoggedIn && hasCharacters.value && !isEditing.value
})

// Copy availability from existing character
const availDonors = computed(() =>
  entriesStore.myEntries.filter(e => Object.keys(e.availability || {}).length > 0)
)

const showAvailCopier = computed(() =>
  creatingNew.value && !isEditing.value && availDonors.value.length > 0
)

function onAvailCopy(event: Event) {
  const target = event.target as HTMLSelectElement
  const id = target.value
  if (id === '') { avail.value = {}; return }
  const entry = availDonors.value.find(e => e.id === id)
  if (!entry) return
  avail.value = { ...entry.availability }
}

// Infer specs from roles for legacy entries without specs
function inferSpecs(className: string, roles: string[]): string[] {
  const cspecs = CLASS_SPECS[className] || []
  if (!roles || !roles.length) return []
  const out: string[] = []
  roles.forEach(r => {
    const matching = cspecs.filter(s => s.role === r)
    if (matching.length === 1) out.push(matching[0].name)
  })
  return out
}

function loadEditEntry(id: string) {
  const entry = entriesStore.entries.find(e => e.id === id)
  if (!entry) return

  creatingNew.value = false
  editId.value = id
  name.value = entry.charName
  cls.value = entry.className
  const oldRoles = entry.roles || []
  const entrySpecs = entry.specs && entry.specs.length ? entry.specs : inferSpecs(entry.className, oldRoles)
  specs.value = entrySpecs
  avail.value = migrateLegacyAvail(entry.availability)
  notes.value = entry.notes || ''
}

function onClassChange(newClass: string) {
  cls.value = newClass
  specs.value = []
}

function onCharPick(event: Event) {
  const target = event.target as HTMLSelectElement
  const idx = target.value
  if (idx === '') {
    name.value = ''
    cls.value = null
    specs.value = []
    return
  }
  const char = pickCharacter(parseInt(idx))
  if (!char) return
  name.value = char.name
  cls.value = char.className
  specs.value = []
}

async function handleSubmit() {
  if (!canSave.value || submitting.value) return
  submitting.value = true
  const success = await submit(
    {
      name: name.value,
      cls: cls.value!,
      specs: specs.value,
      avail: avail.value,
      notes: notes.value,
    },
    editId.value
  )
  if (success) {
    cancelEdit()
  } else {
    submitting.value = false
  }
}

function cancelEdit() {
  editId.value = null
  name.value = ''
  cls.value = null
  specs.value = []
  avail.value = {}
  notes.value = ''
  creatingNew.value = false
  submitting.value = false
}

function startNewCharacter() {
  cancelEdit()
  creatingNew.value = true
}

function editMyEntry(id: string) {
  loadEditEntry(id)
}

async function handleSetMain(id: string) {
  await entriesStore.setMain(id)
}

function confirmDelete(id: string) {
  deleteTarget.value = id
  showDeleteConfirm.value = true
}

async function executeDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await entriesStore.remove(deleteTarget.value)
  } finally {
    deleting.value = false
    showDeleteConfirm.value = false
    deleteTarget.value = null
  }
}

// Availability slot count for a character
function availCount(availability: AvailabilityMap | undefined): number {
  if (!availability) return 0
  return Object.keys(availability).length
}

// Check if a character has active raid signups
function hasActiveSignups(charName: string): boolean {
  return raidsStore.raids.some(r =>
    (r.signups || []).some(s => s.charName === charName && s.status !== 'declined')
  )
}

// Spec role color lookup
function specRoleColor(className: string, specName: string): string {
  const cspecs = CLASS_SPECS[className] || []
  const sp = cspecs.find(s => s.name === specName)
  return sp ? ROLE_COLORS[sp.role] : ROLE_COLORS.DPS
}

// Delete target entry for the confirmation message
const deleteTargetEntry = computed(() => {
  if (!deleteTarget.value) return null
  return entriesStore.entries.find(e => e.id === deleteTarget.value)
})

// Discord status helpers
async function handleDiscordLink() {
  await auth.discordLink()
}

async function handleDiscordUnlink() {
  await auth.discordUnlink()
}

// Check for edit mode from query param
onMounted(async () => {
  if (!entriesStore.entries.length) await entriesStore.load()
  // Load raids in background for signup status (non-blocking)
  if (!raidsStore.raids.length) raidsStore.load().catch(() => {})

  const editParam = route.query.edit as string | undefined
  if (editParam) {
    loadEditEntry(editParam)
  }
  // Scroll to hash anchor (e.g. #availability)
  if (route.hash) {
    setTimeout(() => {
      const el = document.querySelector(route.hash)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 200)
  }
})

// Watch for route query changes (e.g. navigating to ?edit=id)
watch(() => route.query.edit, (newEditId) => {
  if (newEditId && typeof newEditId === 'string') {
    loadEditEntry(newEditId)
  }
})
</script>

<template>
  <div id="v-form">
    <!-- Auth gate -->
    <div v-if="!auth.isLoggedIn" class="auth-hint">
      Bitte melde dich an, um dein Konto zu verwalten.<br />
      <button class="btn-bnet" @click="auth.bnetLogin()">
        Mit Battle.net anmelden
      </button>
    </div>

    <template v-else>
      <!-- Account header -->
      <div class="card account-header">
        <div class="ah-top">
          <div class="ah-info">
            <div class="ah-username">{{ auth.user?.username }}</div>
            <div class="ah-badges">
              <span v-if="auth.isAdmin" class="ah-badge admin">Admin</span>
              <span class="ah-badge chars">{{ entriesStore.myEntryCount }} {{ entriesStore.myEntryCount === 1 ? 'Charakter' : 'Charaktere' }}</span>
            </div>
          </div>
        </div>

        <!-- Discord status -->
        <div class="ah-discord">
          <template v-if="auth.user?.discordLinked">
            <span class="discord-linked">
              <span class="discord-ico">&#127918;</span>
              {{ auth.user?.discordUsername || 'Discord verbunden' }}
            </span>
            <button class="btn-discord-unlink" @click="handleDiscordUnlink">Trennen</button>
          </template>
          <template v-else>
            <button class="btn-discord-link" @click="handleDiscordLink">
              <span class="discord-ico">&#127918;</span>
              Discord verbinden
            </button>
          </template>
        </div>
      </div>

      <!-- Character cards view -->
      <template v-if="mode === 'cards'">
        <div class="section-title">
          Meine Charaktere
          <span class="section-count">({{ entriesStore.myEntryCount }})</span>
        </div>

        <div v-if="entriesStore.myEntries.length === 0" class="empty-state">
          <div class="empty-msg">Du hast noch keine Charaktere angelegt.</div>
          <button class="btn-new-char" @click="startNewCharacter">Ersten Charakter anlegen</button>
        </div>

        <div v-else class="char-grid">
          <div
            v-for="entry in entriesStore.myEntries"
            :key="entry.id"
            :class="['char-card', { 'is-main': entry.isMain }]"
          >
            <!-- Main badge -->
            <div v-if="entry.isMain" class="main-badge">Main</div>

            <!-- Card header -->
            <div class="cc-header">
              <ClassIcon :class-name="entry.className" size="lg" />
              <div class="cc-identity">
                <div class="cc-name" :style="{ color: cc(entry.className) }">{{ entry.charName }}</div>
                <div class="cc-class">{{ entry.className }}</div>
              </div>
            </div>

            <!-- Specs -->
            <div class="cc-specs">
              <span
                v-for="s in (entry.specs || [])"
                :key="s"
                class="cc-spec-badge"
                :style="{ color: specRoleColor(entry.className, s), borderColor: specRoleColor(entry.className, s) + '40', background: specRoleColor(entry.className, s) + '12' }"
              >{{ s }}</span>
              <span v-if="!entry.specs || entry.specs.length === 0" class="cc-no-specs">Keine Specs</span>
            </div>

            <!-- Availability summary -->
            <div class="cc-avail">
              <template v-if="availCount(entry.availability) > 0">
                <span class="avail-dot yes"></span>
                {{ availCount(entry.availability) }} Zeitfenster
              </template>
              <template v-else>
                <span class="avail-dot none"></span>
                Keine Zeiten eingetragen
              </template>
            </div>

            <!-- Notes -->
            <div v-if="entry.notes" class="cc-notes">{{ entry.notes }}</div>

            <!-- Active signup warning -->
            <div v-if="hasActiveSignups(entry.charName)" class="cc-signup-info">
              Aktive Raid-Anmeldung
            </div>

            <!-- Actions -->
            <div class="cc-actions">
              <button class="btn-cc-edit" @click="editMyEntry(entry.id)">Bearbeiten</button>
              <button
                v-if="!entry.isMain"
                class="btn-cc-main"
                @click="handleSetMain(entry.id)"
              >Als Main setzen</button>
              <button class="btn-cc-del" @click="confirmDelete(entry.id)">Loeschen</button>
            </div>
          </div>

          <!-- Add new character card -->
          <div class="char-card add-card" @click="startNewCharacter">
            <div class="add-icon">+</div>
            <div class="add-label">Neuen Charakter anlegen</div>
          </div>
        </div>

        <!-- BNet characters import section -->
        <div v-if="hasCharacters" class="card bnet-section">
          <div class="bnet-title">Battle.net Charaktere</div>
          <div class="bnet-hint">Importiere Charaktere aus deinem Battle.net-Konto als Vorlage.</div>
          <div class="bnet-list">
            <div
              v-for="(c, i) in characters"
              :key="i"
              class="bnet-char"
            >
              <ClassIcon :class-name="c.className" size="sm" />
              <span class="bnet-char-name" :style="{ color: cc(c.className) }">{{ c.name }}</span>
              <span class="bnet-char-meta">{{ c.className }} &middot; {{ c.realm }} &middot; Lv.{{ c.level }}</span>
            </div>
          </div>
        </div>
      </template>

      <!-- Character form (edit or new) -->
      <template v-if="mode === 'form'">
        <div class="form-back" @click="cancelEdit">&larr; Zurueck zu Meine Charaktere</div>

        <div class="card form-card">
          <div class="form-title">{{ isEditing ? 'Charakter bearbeiten' : 'Neuer Charakter' }}</div>

          <!-- BNet Character Picker (only for new) -->
          <div v-if="showCharPicker" class="fld char-picker">
            <span class="lbl">Charakter importieren</span>
            <span class="lbl-s">W&auml;hle einen Charakter aus deinem Battle.net-Konto</span>
            <select id="f-char-pick" @change="onCharPick">
              <option value="">&mdash; Manuell eingeben &mdash;</option>
              <option
                v-for="(c, i) in characters"
                :key="i"
                :value="i"
              >
                {{ c.name }} &mdash; {{ c.className }} ({{ c.realm }}, Lv.{{ c.level }})
              </option>
            </select>
          </div>

          <!-- Character Name -->
          <div class="fld">
            <span class="lbl">Charaktername</span>
            <input
              id="f-name"
              v-model="name"
              type="text"
              placeholder="z.B. Thrallmächtig"
            />
          </div>

          <!-- Class -->
          <div class="fld">
            <span class="lbl">Klasse</span>
            <ClassChipSelector :model-value="cls" @update:model-value="onClassChange" />
          </div>

          <!-- Specialization -->
          <div class="fld">
            <span class="lbl">Spezialisierung(en)</span>
            <span class="lbl-s">W&auml;hle alle Specs, die du spielen kannst</span>
            <SpecChipSelector
              v-if="cls"
              :class-name="cls"
              v-model="specs"
            />
            <div v-else class="no-class-hint">
              W&auml;hle zuerst eine Klasse
            </div>
          </div>

          <!-- Copy availability from existing character -->
          <div v-if="showAvailCopier" class="fld avail-copier">
            <span class="lbl">Verfügbarkeit übernehmen</span>
            <span class="lbl-s">Übernimm die Zeiten eines bestehenden Charakters als Vorlage</span>
            <select @change="onAvailCopy">
              <option value="">&mdash; Keine Vorlage &mdash;</option>
              <option
                v-for="d in availDonors"
                :key="d.id"
                :value="d.id"
              >
                {{ d.charName }} &mdash; {{ d.className }} ({{ Object.keys(d.availability || {}).length }} Zeitfenster)
              </option>
            </select>
          </div>

          <!-- Availability -->
          <div id="availability" class="fld">
            <span class="lbl">Verfügbarkeit &mdash; Wann kannst du raiden?</span>
            <span class="lbl-s">Markiere deine verfügbaren Zeiten. Diese werden für die Kara-Gruppenplanung verwendet.
              Klick: Ja &#10003; &rarr; Vielleicht ? &rarr; Aus &middot; Ziehen für Bereiche</span>
            <AvailabilityGrid v-model="avail" />
          </div>

          <!-- Notes -->
          <div class="fld">
            <span class="lbl">Anmerkungen (optional)</span>
            <input
              id="f-notes"
              v-model="notes"
              type="text"
              placeholder="z.B. Erste Woche im Monat nicht verfügbar"
            />
          </div>

          <!-- Validation message -->
          <div v-if="!canSave" class="validation-msg">
            Bitte ausf&uuml;llen: {{ missingFields.join(', ') }}
          </div>

          <!-- Buttons -->
          <div class="brow">
            <button
              id="f-submit"
              class="btn-p"
              :disabled="!canSave || submitting"
              @click="handleSubmit"
            >
              {{ submitLabel }}
            </button>
            <button
              class="btn-s"
              @click="cancelEdit"
            >
              Abbrechen
            </button>
          </div>
        </div>
      </template>

      <!-- Delete confirmation -->
      <ConfirmModal
        :open="showDeleteConfirm"
        title="Charakter loeschen"
        :message="deleteTargetEntry
          ? `Soll <strong>${deleteTargetEntry.charName}</strong> (${deleteTargetEntry.className}) wirklich geloescht werden?${hasActiveSignups(deleteTargetEntry.charName) ? '<br/><br/><span style=\'color:#ffb74d\'>Dieser Charakter hat aktive Raid-Anmeldungen!</span>' : ''}`
          : 'Charakter loeschen?'"
        @confirm="executeDelete"
        @cancel="showDeleteConfirm = false"
      />
    </template>
  </div>
</template>

<style scoped>
.auth-hint {
  text-align: center;
  padding: 40px 20px;
  color: var(--color-tx3);
  font-size: 14px;
  line-height: 2;
}

.btn-bnet {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 24px;
  border-radius: 8px;
  font: 600 13px var(--font-body);
  background: #0074e0;
  color: #fff;
  border: none;
  cursor: pointer;
  transition: background 0.15s;
  margin-top: 8px;
}
.btn-bnet:hover { background: #0066c8; }

.card {
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
}

/* Account header */
.account-header {
  padding: 20px;
  margin-bottom: 20px;
}
.ah-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.ah-username {
  font: 700 18px var(--font-heading);
  color: var(--color-tx);
}
.ah-badges {
  display: flex;
  gap: 6px;
  margin-top: 4px;
}
.ah-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.ah-badge.admin {
  background: rgba(201, 168, 76, 0.2);
  color: var(--color-gold);
  border: 1px solid rgba(201, 168, 76, 0.3);
}
.ah-badge.chars {
  background: rgba(255, 255, 255, 0.04);
  color: var(--color-tx3);
  border: 1px solid var(--color-border);
}

.ah-discord {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-top: 12px;
  border-top: 1px solid var(--color-border);
}
.discord-linked {
  font-size: 13px;
  color: #7289da;
  display: flex;
  align-items: center;
  gap: 6px;
}
.discord-ico { font-size: 16px; }
.btn-discord-link {
  padding: 6px 14px;
  border-radius: 6px;
  font: 600 12px var(--font-body);
  border: 1px solid rgba(114, 137, 218, 0.3);
  background: rgba(114, 137, 218, 0.08);
  color: #7289da;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.15s;
}
.btn-discord-link:hover { background: rgba(114, 137, 218, 0.15); }
.btn-discord-unlink {
  padding: 4px 10px;
  border-radius: 4px;
  font: 12px var(--font-body);
  border: 1px solid var(--color-border);
  background: none;
  color: var(--color-tx4);
  cursor: pointer;
  transition: all 0.15s;
}
.btn-discord-unlink:hover { color: var(--color-dps); border-color: rgba(229, 115, 115, 0.3); }

/* Section title */
.section-title {
  font: 600 16px var(--font-heading);
  color: var(--color-gold);
  margin-bottom: 14px;
}
.section-count {
  font-weight: 400;
  font-size: 13px;
  color: var(--color-tx4);
}

/* Empty state */
.empty-state {
  text-align: center;
  padding: 32px 20px;
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
}
.empty-msg {
  font-size: 14px;
  color: var(--color-tx3);
  margin-bottom: 16px;
}
.btn-new-char {
  padding: 10px 24px;
  border-radius: 8px;
  font: 600 13px var(--font-body);
  background: linear-gradient(135deg, var(--color-gold-dark), var(--color-gold));
  color: #1a1028;
  border: none;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-new-char:hover { background: linear-gradient(135deg, var(--color-gold), var(--color-gold-light)); }

/* Character grid */
.char-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}

.char-card {
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 16px;
  position: relative;
  transition: border-color 0.15s;
}
.char-card:hover { border-color: rgba(255, 255, 255, 0.12); }
.char-card.is-main {
  border-color: rgba(201, 168, 76, 0.35);
  box-shadow: 0 0 12px rgba(201, 168, 76, 0.08);
}

.main-badge {
  position: absolute;
  top: 10px;
  right: 12px;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(201, 168, 76, 0.2);
  color: var(--color-gold);
  border: 1px solid rgba(201, 168, 76, 0.3);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.cc-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.cc-name {
  font: 700 15px var(--font-heading);
}
.cc-class {
  font-size: 12px;
  color: var(--color-tx3);
}

.cc-specs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}
.cc-spec-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid;
}
.cc-no-specs {
  font-size: 11px;
  color: var(--color-tx4);
}

.cc-avail {
  font-size: 12px;
  color: var(--color-tx3);
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}
.avail-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.avail-dot.yes { background: var(--color-heal); }
.avail-dot.none { background: #ffb74d; }

.cc-notes {
  font-size: 11px;
  color: var(--color-tx4);
  font-style: italic;
  margin-bottom: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cc-signup-info {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-heal);
  padding: 3px 8px;
  border-radius: 4px;
  background: rgba(102, 187, 106, 0.08);
  display: inline-block;
  margin-bottom: 8px;
}

.cc-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--color-border);
}
.cc-actions button {
  padding: 6px 12px;
  border-radius: 6px;
  font: 600 11px var(--font-body);
  cursor: pointer;
  border: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.02);
  color: var(--color-tx3);
  transition: all 0.15s;
}
.cc-actions button:hover {
  background: rgba(255, 255, 255, 0.06);
  color: var(--color-tx);
}
.btn-cc-edit {
  border-color: rgba(201, 168, 76, 0.3) !important;
  color: var(--color-gold) !important;
  background: rgba(201, 168, 76, 0.08) !important;
}
.btn-cc-edit:hover { background: rgba(201, 168, 76, 0.15) !important; }
.btn-cc-main {
  border-color: rgba(201, 168, 76, 0.2) !important;
  color: var(--color-gold) !important;
}
.btn-cc-main:hover { background: rgba(201, 168, 76, 0.1) !important; }
.btn-cc-del {
  color: var(--color-tx4) !important;
  margin-left: auto;
}
.btn-cc-del:hover { color: var(--color-dps) !important; border-color: rgba(229, 115, 115, 0.3) !important; }

/* Add character card */
.add-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  min-height: 160px;
  border-style: dashed;
  border-color: rgba(255, 255, 255, 0.08);
  transition: all 0.15s;
}
.add-card:hover {
  border-color: rgba(201, 168, 76, 0.3);
  background: rgba(201, 168, 76, 0.04);
}
.add-icon {
  font-size: 32px;
  color: var(--color-tx4);
  margin-bottom: 8px;
}
.add-label {
  font-size: 13px;
  color: var(--color-tx3);
}

/* BNet section */
.bnet-section {
  padding: 16px;
  margin-bottom: 16px;
}
.bnet-title {
  font: 600 14px var(--font-heading);
  color: var(--color-tx2);
  margin-bottom: 4px;
}
.bnet-hint {
  font-size: 12px;
  color: var(--color-tx4);
  margin-bottom: 10px;
}
.bnet-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.bnet-char {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.02);
}
.bnet-char-name {
  font-weight: 600;
  font-size: 13px;
}
.bnet-char-meta {
  font-size: 11px;
  color: var(--color-tx4);
}

/* Form */
.form-back {
  font-size: 13px;
  color: var(--color-gold);
  cursor: pointer;
  margin-bottom: 14px;
}
.form-back:hover { text-decoration: underline; }

.form-card {
  padding: 28px;
}

.form-title {
  font: 700 17px var(--font-heading);
  color: var(--color-gold);
  margin-bottom: 20px;
}

.fld {
  margin-bottom: 20px;
}

.lbl {
  display: block;
  font: 600 13px var(--font-body);
  color: var(--color-tx);
  margin-bottom: 6px;
}

.lbl-s {
  display: block;
  font-size: 11px;
  color: var(--color-tx4);
  margin-bottom: 8px;
}

.char-picker select,
.avail-copier select {
  width: 100%;
  padding: 8px 12px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--color-border);
  color: var(--color-tx);
  font: 13px var(--font-body);
}

input[type="text"] {
  width: 100%;
  padding: 10px 14px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--color-border);
  color: var(--color-tx);
  font: 14px var(--font-body);
  outline: none;
  transition: border-color 0.15s;
}

input[type="text"]:focus {
  border-color: var(--color-gold);
}

.no-class-hint {
  font-size: 12px;
  color: var(--color-tx4);
}

.validation-msg {
  font-size: 12px;
  color: #e57373;
  margin-bottom: 8px;
}

.brow {
  display: flex;
  gap: 10px;
}

.btn-p {
  padding: 10px 28px;
  border-radius: 8px;
  font: 600 14px var(--font-body);
  background: linear-gradient(135deg, var(--color-gold-dark), var(--color-gold));
  color: #1a1028;
  border: none;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-p:hover:not(:disabled) {
  background: linear-gradient(135deg, var(--color-gold), var(--color-gold-light));
}
.btn-p:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-s {
  padding: 10px 20px;
  border-radius: 8px;
  font: 600 13px var(--font-body);
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--color-border);
  color: var(--color-tx3);
  cursor: pointer;
  transition: all 0.15s;
}
.btn-s:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--color-tx);
}

@media (max-width: 767px) {
  .account-header { padding: 14px; }
  .form-card { padding: 16px; }
  .fld { margin-bottom: 16px; }
  .char-grid { grid-template-columns: 1fr; }
  .ah-username { font-size: 16px; }
}
</style>
