<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useEntriesStore } from '@/stores/entries'
import { useKaraSignupsStore, getIdWeekStart, getIdWeekEnd } from '@/stores/karaSignups'
import { CLASS_SPECS, DAYS, DAY_SHORT, ROLE_COLORS, WOW_ICONS } from '@/lib/constants'
import type { RoleName } from '@/lib/constants'
import type { AvailabilityMap } from '@/types'
import ClassIcon from '@/components/shared/ClassIcon.vue'
import KaraSignupTimeGrid from './KaraSignupTimeGrid.vue'
import { cc } from '@/lib/utils'

const authStore = useAuthStore()
const entriesStore = useEntriesStore()
const karaStore = useKaraSignupsStore()

const editing = ref(false)
const selectedSpec = ref('')
const selectedDays = ref<string[]>([])
const useCustomTimes = ref(false)
const customSlots = ref<AvailabilityMap>({})
const submitting = ref(false)

// Find user's entry
const myEntry = computed(() => {
  if (!authStore.user) return null
  return entriesStore.entries.find(e => e.userId === authStore.user!.userId) ?? null
})

// Available specs from entry
const availableSpecs = computed(() => {
  if (!myEntry.value) return []
  return (CLASS_SPECS[myEntry.value.className] || []).filter(s =>
    myEntry.value!.specs.includes(s.name)
  )
})

// Week dates
const weekStart = computed(() => getIdWeekStart(0))
const weekEnd = computed(() => getIdWeekEnd(weekStart.value))

function fmtShort(d: Date): string {
  return `${DAY_SHORT[DAYS[((d.getDay() + 6) % 7)]]} ${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`
}

const weekLabel = computed(() => `${fmtShort(weekStart.value)} – ${fmtShort(weekEnd.value)}`)

// Prefill form from existing signup
function startEdit() {
  const existing = karaStore.mySignup
  if (existing) {
    selectedSpec.value = existing.spec
    selectedDays.value = [...existing.days]
    useCustomTimes.value = existing.useCustomTimes
    customSlots.value = existing.customSlots ? { ...existing.customSlots } : {}
  } else {
    selectedSpec.value = availableSpecs.value.length === 1 ? availableSpecs.value[0].name : ''
    selectedDays.value = []
    useCustomTimes.value = false
    customSlots.value = {}
  }
  editing.value = true
}

function cancelEdit() {
  editing.value = false
}

const canSubmit = computed(() => selectedSpec.value && selectedDays.value.length > 0)

function toggleDay(day: string) {
  const idx = selectedDays.value.indexOf(day)
  if (idx >= 0) {
    selectedDays.value.splice(idx, 1)
  } else {
    selectedDays.value.push(day)
  }
}

function selectSpec(name: string) {
  selectedSpec.value = name
}

async function submit() {
  if (!canSubmit.value || !myEntry.value) return
  submitting.value = true
  try {
    await karaStore.signup({
      entryId: myEntry.value.id,
      spec: selectedSpec.value,
      days: selectedDays.value,
      customSlots: useCustomTimes.value ? customSlots.value : undefined,
      useCustomTimes: useCustomTimes.value,
    })
    editing.value = false
  } finally {
    submitting.value = false
  }
}

async function handleWithdraw() {
  submitting.value = true
  try {
    await karaStore.withdraw()
    editing.value = false
  } finally {
    submitting.value = false
  }
}

function specRole(specName: string): RoleName {
  if (!myEntry.value) return 'DPS'
  const specDef = (CLASS_SPECS[myEntry.value.className] || []).find(s => s.name === specName)
  return (specDef?.role as RoleName) ?? 'DPS'
}

function roleColor(role: RoleName): string {
  return ROLE_COLORS[role]
}

// Auto-select spec if only one available
watch(availableSpecs, (specs) => {
  if (specs.length === 1 && !selectedSpec.value) {
    selectedSpec.value = specs[0].name
  }
}, { immediate: true })
</script>

<template>
  <div v-if="myEntry" class="card dash-card kara-signup-card">
    <div class="card-t">
      <span class="kara-icon">⚔</span>
      Karazhan diese Woche
      <span class="week-label">{{ weekLabel }}</span>
    </div>

    <!-- Summary bar: how many signed up -->
    <div class="signup-summary">
      <span class="signup-count">{{ karaStore.signups.length }} Angemeldet</span>
      <span v-if="karaStore.signups.length > 0" class="role-counts">
        <span :style="{ color: ROLE_COLORS.Tank }">{{ karaStore.roleCounts.Tank }} Tank</span>
        <span :style="{ color: ROLE_COLORS.Heiler }">{{ karaStore.roleCounts.Heiler }} Heiler</span>
        <span :style="{ color: ROLE_COLORS.DPS }">{{ karaStore.roleCounts.DPS }} DPS</span>
      </span>
    </div>

    <!-- Already signed up: show status -->
    <template v-if="karaStore.mySignup && !editing">
      <div class="my-signup">
        <div class="ms-left">
          <ClassIcon :class-name="karaStore.mySignup.className" size="sm" />
          <div>
            <span class="ms-name" :style="{ color: cc(karaStore.mySignup.className) }">
              {{ karaStore.mySignup.charName }}
            </span>
            <span class="ms-spec" :style="{ color: roleColor(karaStore.mySignup.role) }">
              {{ karaStore.mySignup.spec }}
            </span>
          </div>
        </div>
        <div class="ms-days">
          <span v-for="d in karaStore.mySignup.days" :key="d" class="day-mini">{{ DAY_SHORT[d] }}</span>
        </div>
        <span class="ms-badge">Angemeldet</span>
      </div>
      <div class="ms-actions">
        <button class="btn-edit" @click="startEdit">Bearbeiten</button>
        <button class="btn-withdraw" :disabled="submitting" @click="handleWithdraw">Abmelden</button>
      </div>
    </template>

    <!-- Signup form -->
    <template v-else-if="editing">
      <div class="signup-form">
        <!-- Spec selection -->
        <div class="sf-section">
          <div class="sf-label">Spec</div>
          <div class="sf-specs">
            <div
              v-for="spec in availableSpecs"
              :key="spec.name"
              class="sf-spec"
              :class="{ active: selectedSpec === spec.name }"
              :style="selectedSpec === spec.name ? {
                borderColor: roleColor(spec.role),
                color: roleColor(spec.role),
                background: roleColor(spec.role) + '18'
              } : {}"
              @click="selectSpec(spec.name)"
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
        </div>

        <!-- Custom time grid -->
        <KaraSignupTimeGrid
          v-if="useCustomTimes && selectedDays.length > 0"
          v-model="customSlots"
          :days="selectedDays"
          :entry-availability="myEntry.availability || {}"
        />

        <!-- Actions -->
        <div class="sf-actions">
          <button class="btn-cancel" @click="cancelEdit">Abbrechen</button>
          <button class="btn-submit" :disabled="!canSubmit || submitting" @click="submit">
            {{ karaStore.mySignup ? 'Aktualisieren' : 'Anmelden' }}
          </button>
        </div>
      </div>
    </template>

    <!-- Not signed up: CTA -->
    <template v-else>
      <div class="cta-area">
        <button class="btn-signup" @click="startEdit">Für Kara anmelden</button>
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
.ms-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
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
.btn-cancel, .btn-edit, .btn-withdraw {
  padding: 8px 16px;
  border-radius: 6px;
  font: 600 12px var(--font-body);
  cursor: pointer;
  transition: all 0.15s;
  border: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.03);
  color: var(--color-tx3);
}
.btn-cancel:hover, .btn-edit:hover { background: rgba(255, 255, 255, 0.06); }
.btn-withdraw {
  border-color: rgba(229, 115, 115, 0.3);
  color: var(--color-dps);
}
.btn-withdraw:hover { background: rgba(229, 115, 115, 0.08); }
.btn-withdraw:disabled { opacity: 0.5; cursor: not-allowed; }

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
</style>
