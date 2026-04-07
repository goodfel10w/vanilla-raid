<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useEntriesStore } from '@/stores/entries'
import { useKaraSignupsStore, getIdWeekStart, getIdWeekEnd } from '@/stores/karaSignups'
import { CLASS_SPECS, DAYS, DAY_SHORT, ROLE_COLORS, WOW_ICONS } from '@/lib/constants'
import type { RoleName } from '@/lib/constants'
import type { AvailabilityMap, KaraSignup } from '@/types'
import ClassIcon from '@/components/shared/ClassIcon.vue'
import KaraSignupTimeGrid from './KaraSignupTimeGrid.vue'
import { cc } from '@/lib/utils'

const authStore = useAuthStore()
const entriesStore = useEntriesStore()
const karaStore = useKaraSignupsStore()

const editing = ref(false)
const editingEntryId = ref<string | null>(null) // null = adding new
const selectedEntryId = ref('')
const selectedSpecs = ref<string[]>([])
const selectedDays = ref<string[]>([])
const useCustomTimes = ref(false)
const customSlots = ref<AvailabilityMap>({})
const submitting = ref(false)

// All entries belonging to the user
const myEntries = computed(() => entriesStore.myEntries)

// Entry IDs already signed up this week
const signedUpEntryIds = computed(() =>
  new Set(karaStore.mySignups.map(s => s.entryId))
)

// Characters available for new signup (not yet signed up)
const availableEntries = computed(() =>
  myEntries.value.filter(e => !signedUpEntryIds.value.has(e.id))
)

// Currently selected entry
const myEntry = computed(() => {
  if (myEntries.value.length === 0) return null
  if (selectedEntryId.value) {
    return myEntries.value.find(e => e.id === selectedEntryId.value) ?? null
  }
  return null
})

// All specs for the player's class
const availableSpecs = computed(() => {
  if (!myEntry.value) return []
  return CLASS_SPECS[myEntry.value.className] || []
})

// Week navigation
const weekStart = computed(() => getIdWeekStart(karaStore.weekOffset))
const weekEnd = computed(() => getIdWeekEnd(weekStart.value))

function fmtShort(d: Date): string {
  return `${DAY_SHORT[DAYS[((d.getDay() + 6) % 7)]]} ${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`
}

const weekLabel = computed(() => `${fmtShort(weekStart.value)} – ${fmtShort(weekEnd.value)}`)
const isCurrentWeek = computed(() => karaStore.weekOffset === 0)
const isNextWeek = computed(() => karaStore.weekOffset === 1)

function showWeek(offset: number) {
  editing.value = false
  editingEntryId.value = null
  karaStore.load(offset)
}

// Start editing an existing signup
function startEditSignup(signup: KaraSignup) {
  editingEntryId.value = signup.entryId
  selectedEntryId.value = signup.entryId
  selectedSpecs.value = [...(signup.specs ?? [])]
  selectedDays.value = [...signup.days]
  useCustomTimes.value = signup.useCustomTimes
  customSlots.value = signup.customSlots ? { ...signup.customSlots } : {}
  editing.value = true
}

// Start adding a new character signup
function startAddNew() {
  editingEntryId.value = null
  const first = availableEntries.value[0]
  selectedEntryId.value = first?.id || ''
  selectedSpecs.value = first?.specs ? [...first.specs] : []
  selectedDays.value = []
  useCustomTimes.value = false
  customSlots.value = {}
  editing.value = true
}

// Legacy: start edit for single signup or add new
function startEdit() {
  if (karaStore.mySignups.length > 0) {
    startEditSignup(karaStore.mySignups[0])
  } else {
    startAddNew()
  }
}

function selectEntry(id: string) {
  const prevEntry = myEntry.value
  const newEntry = myEntries.value.find(e => e.id === id)
  selectedEntryId.value = id
  if (newEntry && prevEntry && newEntry.className === prevEntry.className) {
    // Same class: keep current spec selection
  } else if (newEntry?.specs?.length) {
    selectedSpecs.value = [...newEntry.specs]
  } else {
    selectedSpecs.value = []
  }
}

function cancelEdit() {
  editing.value = false
  editingEntryId.value = null
}

const canSubmit = computed(() => myEntry.value && selectedSpecs.value.length > 0 && selectedDays.value.length > 0)

function toggleDay(day: string) {
  const idx = selectedDays.value.indexOf(day)
  if (idx >= 0) {
    selectedDays.value.splice(idx, 1)
  } else {
    selectedDays.value.push(day)
  }
}

function toggleSpec(name: string) {
  const idx = selectedSpecs.value.indexOf(name)
  if (idx >= 0) {
    selectedSpecs.value.splice(idx, 1)
  } else {
    selectedSpecs.value.push(name)
  }
}

async function submit() {
  if (!canSubmit.value || !myEntry.value) return
  submitting.value = true
  try {
    await karaStore.signup({
      entryId: myEntry.value.id,
      specs: selectedSpecs.value,
      days: selectedDays.value,
      customSlots: useCustomTimes.value ? customSlots.value : undefined,
      useCustomTimes: useCustomTimes.value,
    })
    editing.value = false
    editingEntryId.value = null
  } finally {
    submitting.value = false
  }
}

async function handleWithdraw(entryId: string) {
  submitting.value = true
  try {
    await karaStore.withdraw(entryId)
    editing.value = false
    editingEntryId.value = null
  } finally {
    submitting.value = false
  }
}

function specRole(specName: string, className?: string): RoleName {
  const cn = className || myEntry.value?.className
  if (!cn) return 'DPS'
  const specDef = (CLASS_SPECS[cn] || []).find(s => s.name === specName)
  return (specDef?.role as RoleName) ?? 'DPS'
}

function roleColor(role: RoleName): string {
  return ROLE_COLORS[role]
}

// Check if selected entry has availability data
const hasAvailability = computed(() => {
  if (!myEntry.value) return false
  return Object.keys(myEntry.value.availability || {}).length > 0
})

// Entries to show in character picker during editing
const charPickerEntries = computed(() => {
  if (editingEntryId.value) {
    // When editing, only show the character being edited
    return myEntries.value.filter(e => e.id === editingEntryId.value)
  }
  // When adding new, show only un-signed characters
  return availableEntries.value
})

// Auto-select all specs if only one for the chosen class
watch(availableSpecs, (specs) => {
  if (specs.length === 1 && selectedSpecs.value.length === 0) {
    selectedSpecs.value = [specs[0].name]
  }
}, { immediate: true })
</script>

<template>
  <div v-if="myEntries.length > 0" class="card dash-card kara-signup-card">
    <div class="card-t">
      <span class="kara-icon">⚔</span>
      Karazhan
      <span class="week-label">{{ weekLabel }}</span>
    </div>
    <div class="week-tabs">
      <button
        class="week-tab"
        :class="{ active: isCurrentWeek }"
        @click="showWeek(0)"
      >Diese Woche</button>
      <button
        class="week-tab"
        :class="{ active: isNextWeek }"
        @click="showWeek(1)"
      >Nächste Woche</button>
    </div>

    <!-- Summary bar -->
    <div class="signup-summary">
      <span class="signup-count">{{ karaStore.signups.length }} Angemeldet</span>
      <span v-if="karaStore.signups.length > 0" class="role-counts">
        <span :style="{ color: ROLE_COLORS.Tank }">{{ karaStore.roleCounts.Tank }} Tank</span>
        <span :style="{ color: ROLE_COLORS.Heiler }">{{ karaStore.roleCounts.Heiler }} Heiler</span>
        <span :style="{ color: ROLE_COLORS.DPS }">{{ karaStore.roleCounts.DPS }} DPS</span>
      </span>
    </div>

    <!-- My signups list (when not editing) -->
    <template v-if="karaStore.mySignups.length > 0 && !editing">
      <div
        v-for="signup in karaStore.mySignups"
        :key="signup.entryId"
        class="my-signup"
      >
        <div class="ms-left">
          <ClassIcon :class-name="signup.className" size="sm" />
          <div>
            <span class="ms-name" :style="{ color: cc(signup.className) }">
              {{ signup.charName }}
            </span>
            <span
              v-for="s in (signup.specs ?? [])"
              :key="s"
              class="ms-spec"
              :style="{ color: roleColor(specRole(s, signup.className)) }"
            >{{ s }}</span>
          </div>
        </div>
        <div class="ms-days">
          <span v-for="d in signup.days" :key="d" class="day-mini">{{ DAY_SHORT[d] }}</span>
        </div>
        <span class="ms-badge">Angemeldet</span>
        <div class="ms-actions-inline">
          <button class="btn-edit-sm" @click="startEditSignup(signup)">Bearbeiten</button>
          <button class="btn-withdraw-sm" :disabled="submitting" @click="handleWithdraw(signup.entryId)">Abmelden</button>
        </div>
      </div>

      <!-- Add another character button -->
      <div v-if="availableEntries.length > 0" class="add-char-area">
        <button class="btn-add-char" @click="startAddNew">+ Weiteren Charakter anmelden</button>
      </div>
    </template>

    <!-- Signup form -->
    <template v-else-if="editing">
      <div class="signup-form">
        <!-- Character selection -->
        <div class="sf-section">
          <div class="sf-label">Charakter</div>
          <div class="sf-chars">
            <div
              v-for="entry in charPickerEntries"
              :key="entry.id"
              class="sf-char"
              :class="{ active: selectedEntryId === entry.id }"
              :style="selectedEntryId === entry.id ? {
                borderColor: cc(entry.className),
                color: cc(entry.className),
                background: cc(entry.className) + '18'
              } : {}"
              @click="selectEntry(entry.id)"
            >
              <ClassIcon :class-name="entry.className" size="sm" />
              {{ entry.charName }}
            </div>
          </div>
        </div>

        <!-- Spec selection -->
        <div class="sf-section">
          <div class="sf-label">Specs (mehrere möglich)</div>
          <div class="sf-specs">
            <div
              v-for="spec in availableSpecs"
              :key="spec.name"
              class="sf-spec"
              :class="{ active: selectedSpecs.includes(spec.name) }"
              :style="selectedSpecs.includes(spec.name) ? {
                borderColor: roleColor(spec.role),
                color: roleColor(spec.role),
                background: roleColor(spec.role) + '18'
              } : {}"
              @click="toggleSpec(spec.name)"
            >
              <img class="wow-ico" :src="`${WOW_ICONS}/spec/${spec.icon}.png`" :alt="spec.name" loading="lazy" />
              {{ spec.name }}
            </div>
          </div>
        </div>

        <!-- Day selection -->
        <div class="sf-section">
          <div class="sf-label">Tage</div>
          <div class="sf-days">
            <div
              v-for="day in DAYS"
              :key="day"
              class="sf-day"
              :class="{ active: selectedDays.includes(day) }"
              @click="toggleDay(day)"
            >
              {{ DAY_SHORT[day] }}
            </div>
          </div>
        </div>

        <!-- Custom times toggle -->
        <div class="sf-section">
          <label class="sf-toggle">
            <input v-model="useCustomTimes" type="checkbox" />
            <span>Eigene Zeiten angeben</span>
          </label>
          <div v-if="!useCustomTimes" class="sf-hint">
            Deine Zeiten aus dem <router-link to="/form#availability">Profil</router-link> werden verwendet.
          </div>
        </div>

        <!-- Custom time grid -->
        <KaraSignupTimeGrid
          v-if="useCustomTimes && selectedDays.length > 0"
          v-model="customSlots"
          :days="selectedDays"
          :entry-availability="myEntry?.availability || {}"
        />

        <!-- No availability warning -->
        <div v-if="myEntry && !hasAvailability && !useCustomTimes" class="kara-warn">
          Dein Charakter hat keine Zeiten im Profil.
          <router-link to="/form#availability" class="kara-warn-link">Jetzt eintragen</router-link>
          oder aktiviere oben "Eigene Zeiten angeben".
        </div>

        <!-- Actions -->
        <div class="sf-actions">
          <button class="btn-cancel" @click="cancelEdit">Abbrechen</button>
          <button class="btn-submit" :disabled="!canSubmit || submitting" @click="submit">
            {{ editingEntryId ? 'Aktualisieren' : 'Anmelden' }}
          </button>
        </div>
      </div>
    </template>

    <!-- Not signed up: CTA -->
    <template v-else>
      <div class="cta-area">
        <button class="btn-signup" @click="startAddNew">Für Kara anmelden</button>
        <div class="cta-info">
          Melde dich an, damit die Raidleitung Kara-Gruppen planen kann.
          Wähle deinen Spec, bevorzugte Tage und optional eigene Zeiten.
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.card {
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 20px;
}
.dash-card { margin-bottom: 16px; }
.card-t {
  font: 600 15px var(--font-heading);
  color: var(--color-gold);
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.kara-icon { font-size: 18px; }
.week-label {
  font: 400 12px var(--font-body);
  color: var(--color-tx3);
  margin-left: auto;
}

/* Week tabs */
.week-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 12px;
}
.week-tab {
  flex: 1;
  padding: 6px 12px;
  border-radius: 6px;
  font: 600 12px var(--font-body);
  border: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.02);
  color: var(--color-tx3);
  cursor: pointer;
  transition: all 0.15s;
}
.week-tab:hover { background: rgba(255, 255, 255, 0.05); }
.week-tab.active {
  background: rgba(201, 168, 76, 0.12);
  border-color: rgba(201, 168, 76, 0.3);
  color: var(--color-gold);
}

/* Summary */
.signup-summary {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.02);
  margin-bottom: 12px;
  font-size: 13px;
  flex-wrap: wrap;
}
.signup-count {
  font-weight: 600;
  color: var(--color-tx2);
}
.role-counts {
  display: flex;
  gap: 10px;
  font-size: 12px;
}

/* My signup display */
.my-signup {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(102, 187, 106, 0.06);
  border: 1px solid rgba(102, 187, 106, 0.15);
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.ms-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ms-name {
  font-weight: 600;
  font-size: 14px;
}
.ms-spec {
  font-size: 12px;
  margin-left: 6px;
}
.ms-days {
  display: flex;
  gap: 4px;
  margin-left: auto;
}
.day-mini {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(201, 168, 76, 0.1);
  color: var(--color-gold);
}
.ms-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 4px;
  background: rgba(102, 187, 106, 0.12);
  color: var(--color-heal);
  white-space: nowrap;
}
.ms-actions-inline {
  display: flex;
  gap: 6px;
  width: 100%;
  margin-top: 4px;
}
.btn-edit-sm, .btn-withdraw-sm {
  padding: 5px 12px;
  border-radius: 5px;
  font: 600 11px var(--font-body);
  cursor: pointer;
  transition: all 0.15s;
  border: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.03);
  color: var(--color-tx3);
}
.btn-edit-sm:hover { background: rgba(255, 255, 255, 0.06); }
.btn-withdraw-sm {
  border-color: rgba(229, 115, 115, 0.3);
  color: var(--color-dps);
}
.btn-withdraw-sm:hover { background: rgba(229, 115, 115, 0.08); }
.btn-withdraw-sm:disabled { opacity: 0.5; cursor: not-allowed; }

/* Add character area */
.add-char-area {
  margin-top: 4px;
}
.btn-add-char {
  width: 100%;
  padding: 8px 16px;
  border-radius: 8px;
  font: 600 12px var(--font-body);
  border: 1px dashed rgba(201, 168, 76, 0.3);
  background: rgba(201, 168, 76, 0.04);
  color: var(--color-gold);
  cursor: pointer;
  transition: all 0.15s;
}
.btn-add-char:hover {
  background: rgba(201, 168, 76, 0.1);
  border-color: rgba(201, 168, 76, 0.5);
}

/* CTA */
.cta-area {
  text-align: center;
  padding: 8px 0;
}
.btn-signup {
  padding: 10px 28px;
  border-radius: 8px;
  font: 600 14px var(--font-body);
  background: rgba(201, 168, 76, 0.12);
  border: 1px solid rgba(201, 168, 76, 0.3);
  color: var(--color-gold);
  cursor: pointer;
  transition: all 0.15s;
}
.btn-signup:hover {
  background: rgba(201, 168, 76, 0.2);
  border-color: rgba(201, 168, 76, 0.5);
}

/* Form */
.signup-form { margin-top: 4px; }
.sf-section { margin-bottom: 12px; }
.sf-label {
  font: 600 12px var(--font-body);
  color: var(--color-tx3);
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Char chips */
.sf-chars {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.sf-char {
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
  font: 600 12px var(--font-body);
  border: 2px solid var(--color-border);
  background: rgba(0, 0, 0, 0.2);
  color: var(--color-tx3);
  transition: all 0.15s;
  display: flex;
  align-items: center;
  gap: 5px;
  user-select: none;
}
.sf-char:hover { border-color: rgba(255, 255, 255, 0.12); }

/* Spec chips */
.sf-specs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.sf-spec {
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
  font: 600 12px var(--font-body);
  border: 2px solid var(--color-border);
  background: rgba(0, 0, 0, 0.2);
  color: var(--color-tx3);
  transition: all 0.15s;
  display: flex;
  align-items: center;
  gap: 5px;
  user-select: none;
}
.sf-spec:hover { border-color: rgba(255, 255, 255, 0.12); }
.wow-ico { width: 18px; height: 18px; border-radius: 3px; }

/* Day chips */
.sf-days {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.sf-day {
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font: 600 12px var(--font-body);
  border: 2px solid var(--color-border);
  background: rgba(0, 0, 0, 0.2);
  color: var(--color-tx3);
  transition: all 0.15s;
  user-select: none;
  min-width: 36px;
  text-align: center;
}
.sf-day:hover { border-color: rgba(255, 255, 255, 0.12); }
.sf-day.active {
  border-color: var(--color-gold);
  color: var(--color-gold);
  background: rgba(201, 168, 76, 0.12);
}

/* Toggle */
.sf-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--color-tx2);
  cursor: pointer;
  user-select: none;
}
.sf-toggle input {
  accent-color: var(--color-gold);
}

/* Actions */
.sf-actions {
  display: flex;
  gap: 8px;
  margin-top: 14px;
}
.btn-cancel {
  padding: 8px 16px;
  border-radius: 6px;
  font: 600 12px var(--font-body);
  cursor: pointer;
  transition: all 0.15s;
  border: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.03);
  color: var(--color-tx3);
}
.btn-cancel:hover { background: rgba(255, 255, 255, 0.06); }

.btn-submit {
  padding: 8px 20px;
  border-radius: 6px;
  font: 600 12px var(--font-body);
  cursor: pointer;
  transition: all 0.15s;
  border: 1px solid rgba(201, 168, 76, 0.3);
  background: rgba(201, 168, 76, 0.12);
  color: var(--color-gold);
}
.btn-submit:hover {
  background: rgba(201, 168, 76, 0.2);
  border-color: rgba(201, 168, 76, 0.5);
}
.btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }

/* Info & warnings */
.kara-warn {
  margin-top: 10px;
  padding: 8px 12px;
  border-radius: 6px;
  background: rgba(255, 183, 77, 0.08);
  border: 1px solid rgba(255, 183, 77, 0.2);
  font-size: 12px;
  color: #ffb74d;
  line-height: 1.5;
}
.kara-warn-link {
  color: var(--color-gold);
  font-weight: 600;
  text-decoration: underline;
}
.sf-hint {
  font-size: 11px;
  color: var(--color-tx4);
  margin-top: 4px;
}
.sf-hint a {
  color: var(--color-gold);
  text-decoration: underline;
}
.cta-info {
  margin-top: 10px;
  font-size: 12px;
  color: var(--color-tx4);
  line-height: 1.5;
}
</style>
