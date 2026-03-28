<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useEntriesStore } from '@/stores/entries'
import { useFormSubmit } from '@/composables/useFormSubmit'
import { useBnetCharPicker } from '@/composables/useBnetCharPicker'
import { specsToRoles, migrateLegacyAvail, cc } from '@/lib/utils'
import { CLASS_SPECS } from '@/lib/constants'
import ClassChipSelector from '@/components/shared/ClassChipSelector.vue'
import SpecChipSelector from '@/components/shared/SpecChipSelector.vue'
import AvailabilityGrid from '@/components/shared/AvailabilityGrid.vue'
import type { AvailabilityMap } from '@/types'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const entriesStore = useEntriesStore()
const { submit } = useFormSubmit()
const { characters, hasCharacters, pickCharacter } = useBnetCharPicker()

const name = ref('')
const cls = ref<string | null>(null)
const specs = ref<string[]>([])
const avail = ref<AvailabilityMap>({})
const notes = ref('')
const editId = ref<string | null>(null)
const submitting = ref(false)

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
  if (!success) {
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
}

// User's existing entries
const myEntries = computed(() => {
  if (!auth.user) return []
  return entriesStore.entries.filter(e => e.userId === auth.user!.userId)
})

const showMyEntries = computed(() => {
  return auth.isLoggedIn && myEntries.value.length > 0 && !isEditing.value
})

function editMyEntry(id: string) {
  loadEditEntry(id)
}

// Check for edit mode from query param
onMounted(async () => {
  // Ensure entries are loaded
  if (!entriesStore.entries.length) await entriesStore.load()

  const editParam = route.query.edit as string | undefined
  if (editParam) {
    loadEditEntry(editParam)
  } else if (auth.isLoggedIn) {
    // Auto-load first entry if user has exactly one
    const mine = entriesStore.entries.filter(e => e.userId === auth.user?.userId)
    if (mine.length === 1) {
      loadEditEntry(mine[0].id)
    }
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
      Bitte melde dich an, um dein Profil zu erstellen.<br />
      <button class="btn-bnet" @click="auth.bnetLogin()">
        Mit Battle.net anmelden
      </button>
    </div>

    <!-- My existing entries -->
    <div v-else-if="showMyEntries" class="card form-card">
      <div class="my-entries-section">
        <div class="me-title">Meine Charaktere</div>
        <div class="me-list">
          <div
            v-for="entry in myEntries"
            :key="entry.id"
            class="me-entry"
          >
            <div class="me-left">
              <img
                class="me-icon"
                :src="`https://cdn.jsdelivr.net/gh/orourkek/Wow-Icons@master/images/class/64/${(entry.className === 'Druide' ? 'druid' : entry.className === 'Hexenmeister' ? 'warlock' : entry.className === 'Jäger' ? 'hunter' : entry.className === 'Krieger' ? 'warrior' : entry.className === 'Magier' ? 'mage' : entry.className === 'Paladin' ? 'paladin' : entry.className === 'Priester' ? 'priest' : entry.className === 'Schamane' ? 'shaman' : 'rogue')}.png`"
                :alt="entry.className"
              />
              <div>
                <div class="me-name" :style="{ color: cc(entry.className) }">{{ entry.charName }}</div>
                <div class="me-meta">{{ entry.className }} &middot; {{ (entry.specs || entry.roles || []).join(', ') }}</div>
                <div v-if="Object.keys(entry.availability || {}).length === 0" class="me-warn">Keine Zeiten eingetragen</div>
              </div>
            </div>
            <button class="me-edit-btn" @click="editMyEntry(entry.id)">Bearbeiten</button>
          </div>
        </div>
        <button class="me-new-btn" @click="cancelEdit">Neuen Charakter anlegen</button>
      </div>
    </div>

    <!-- Form -->
    <div v-else class="card form-card">
      <!-- BNet Character Picker -->
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
          v-if="isEditing"
          class="btn-s"
          @click="cancelEdit"
        >
          Abbrechen
        </button>
      </div>
    </div>
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

.btn-bnet:hover {
  background: #0066c8;
}

.card {
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
}

.form-card {
  padding: 28px;
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

.char-picker select {
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

/* My entries */
.my-entries-section {
  text-align: left;
}
.me-title {
  font: 600 16px var(--font-heading);
  color: var(--color-gold);
  margin-bottom: 16px;
}
.me-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}
.me-entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  flex-wrap: wrap;
}
.me-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.me-icon {
  width: 28px;
  height: 28px;
  border-radius: 5px;
  flex-shrink: 0;
}
.me-name {
  font: 600 14px var(--font-heading);
}
.me-meta {
  font-size: 12px;
  color: var(--color-tx3);
}
.me-warn {
  font-size: 11px;
  color: #ffb74d;
  font-weight: 600;
  margin-top: 2px;
}
.me-edit-btn {
  padding: 8px 18px;
  border-radius: 6px;
  font: 600 12px var(--font-body);
  cursor: pointer;
  border: 1px solid rgba(201, 168, 76, 0.3);
  background: rgba(201, 168, 76, 0.12);
  color: var(--color-gold);
  transition: all 0.15s;
  flex-shrink: 0;
}
.me-edit-btn:hover {
  background: rgba(201, 168, 76, 0.2);
  border-color: rgba(201, 168, 76, 0.5);
}
.me-new-btn {
  padding: 8px 18px;
  border-radius: 6px;
  font: 600 12px var(--font-body);
  cursor: pointer;
  border: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.03);
  color: var(--color-tx3);
  transition: all 0.15s;
}
.me-new-btn:hover {
  background: rgba(255, 255, 255, 0.06);
}

@media (max-width: 767px) {
  .form-card {
    padding: 16px;
  }

  .fld {
    margin-bottom: 16px;
  }
}
</style>
