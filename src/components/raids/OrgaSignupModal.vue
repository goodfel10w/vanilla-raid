<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { CLS, CLASS_SPECS, WOW_ICONS, ROLE_COLORS } from '@/lib/constants'
import { cc } from '@/lib/utils'
import ClassIcon from '@/components/shared/ClassIcon.vue'
import type { Entry, RaidSignup } from '@/types'

const props = defineProps<{
  open: boolean
  entries: Entry[]
  signups: RaidSignup[]
}>()

const emit = defineEmits<{
  confirm: [payload: {
    charName: string
    className: string
    role: string
    status: string
    note: string
    targetUserId?: string
  }]
  cancel: []
}>()

const selectedEntry = ref('')
const customCharName = ref('')
const customClassName = ref('')
const selectedSpecs = ref<string[]>([])
const selectedStatus = ref('accepted')
const note = ref('')
const submitting = ref(false)

const isCustom = computed(() => selectedEntry.value === '__custom__')

// Entries not already signed up for this raid
const availableEntries = computed(() => {
  const signedUpIds = new Set(props.signups.map(s => s.userId))
  const signedUpNames = new Set(props.signups.map(s => s.charName.toLowerCase()))
  return props.entries.filter(e =>
    !signedUpIds.has(e.userId) && !signedUpNames.has(e.charName.toLowerCase())
  )
})

const activeClassName = computed(() => {
  if (isCustom.value) return customClassName.value
  const entry = props.entries.find(e => e.charName === selectedEntry.value)
  return entry?.className || ''
})

const availableSpecs = computed(() => CLASS_SPECS[activeClassName.value] || [])

function onEntryChange(val: string) {
  selectedEntry.value = val
  selectedSpecs.value = []
  if (val && val !== '__custom__') {
    const entry = props.entries.find(e => e.charName === val)
    if (entry?.specs?.length) {
      selectedSpecs.value = [...entry.specs]
    }
  }
}

function onCustomClassChange(val: string) {
  customClassName.value = val
  selectedSpecs.value = []
}

function toggleSpec(specName: string) {
  const idx = selectedSpecs.value.indexOf(specName)
  if (idx >= 0) {
    selectedSpecs.value.splice(idx, 1)
  } else {
    selectedSpecs.value.push(specName)
  }
}

function specRole(className: string, specName: string): string {
  const specs = CLASS_SPECS[className] || []
  const sp = specs.find(s => s.name === specName)
  return sp?.role || 'DPS'
}

function doConfirm() {
  const charName = isCustom.value ? customCharName.value.trim() : selectedEntry.value
  const className = activeClassName.value
  if (!charName) return
  if (!selectedSpecs.value.length) return

  const role = specRole(className, selectedSpecs.value[0])
  const entry = !isCustom.value ? props.entries.find(e => e.charName === selectedEntry.value) : undefined

  emit('confirm', {
    charName,
    className,
    role,
    status: selectedStatus.value,
    note: note.value.trim(),
    targetUserId: entry?.userId || undefined,
  })
}

// Reset form when opened
watch(() => props.open, (val) => {
  if (val) {
    selectedEntry.value = ''
    customCharName.value = ''
    customClassName.value = ''
    selectedSpecs.value = []
    selectedStatus.value = 'accepted'
    note.value = ''
    submitting.value = false
  }
})
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="modal-bg" @click.self="emit('cancel')">
      <div class="modal signup-modal">
        <div class="modal-title">Spieler anmelden (Raidleiter)</div>

        <div class="su-form">
          <!-- Character selection from pool -->
          <div class="su-row">
            <select
              :value="selectedEntry"
              @change="onEntryChange(($event.target as HTMLSelectElement).value)"
              class="su-select"
            >
              <option value="">-- Charakter waehlen --</option>
              <option
                v-for="e in availableEntries"
                :key="e.charName"
                :value="e.charName"
              >
                {{ e.charName }} ({{ e.className }})
              </option>
              <option value="__custom__">Manuell eingeben...</option>
            </select>
          </div>

          <!-- Manual entry fields -->
          <div v-if="isCustom" class="su-row">
            <input
              v-model="customCharName"
              type="text"
              placeholder="Charaktername"
              class="su-input"
            />
            <select
              :value="customClassName"
              @change="onCustomClassChange(($event.target as HTMLSelectElement).value)"
              class="su-select"
            >
              <option value="">-- Klasse --</option>
              <option v-for="c in CLS" :key="c.name" :value="c.name">{{ c.name }}</option>
            </select>
          </div>

          <!-- Selected character preview -->
          <div v-if="selectedEntry && !isCustom" class="orga-char-preview">
            <ClassIcon :class-name="activeClassName" size="sm" />
            <span :style="{ color: cc(activeClassName) }">{{ selectedEntry }}</span>
            <span class="orga-char-cls">{{ activeClassName }}</span>
          </div>

          <!-- Status -->
          <div class="su-row">
            <select
              v-model="selectedStatus"
              class="su-select"
            >
              <option value="accepted">Dabei</option>
              <option value="tentative">Vielleicht</option>
            </select>
          </div>

          <!-- Spec selection -->
          <div v-if="availableSpecs.length" class="su-specs">
            <span class="su-specs-label">Spec (Mehrfachauswahl):</span>
            <div class="rchips">
              <div
                v-for="sp in availableSpecs"
                :key="sp.name"
                :class="['rchip', { active: selectedSpecs.includes(sp.name) }]"
                :style="selectedSpecs.includes(sp.name) ? {
                  borderColor: ROLE_COLORS[sp.role],
                  color: ROLE_COLORS[sp.role],
                  background: ROLE_COLORS[sp.role] + '18',
                } : {}"
                @click="toggleSpec(sp.name)"
              >
                <img
                  class="wow-ico-sm"
                  :src="`${WOW_ICONS}/spec/${sp.icon}.png`"
                  :alt="sp.name"
                  loading="lazy"
                />
                {{ sp.name }}
              </div>
            </div>
          </div>
          <div v-else-if="activeClassName" class="su-specs">
            <span class="su-specs-label">Keine Specs verfuegbar</span>
          </div>

          <!-- Note + actions -->
          <div class="su-actions">
            <input
              v-model="note"
              type="text"
              placeholder="Anmerkung (optional)"
              class="su-note"
            />
            <button
              class="btn-signup"
              :disabled="submitting"
              @click="doConfirm"
            >
              Anmelden
            </button>
            <button class="btn-s su-cancel" @click="emit('cancel')">Abbrechen</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-bg {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 500;
  animation: fadeIn 0.15s ease;
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
.modal {
  background: #1a1828;
  border: 1px solid rgba(201, 168, 76, 0.25);
  border-radius: 12px;
  padding: 24px;
  max-width: 500px;
  width: 90%;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}
.modal-title {
  font-family: var(--font-heading);
  font-size: 18px;
  font-weight: 700;
  color: var(--color-gold);
  margin-bottom: 16px;
}
.su-form { display: flex; flex-direction: column; gap: 12px; }
.su-row { display: flex; gap: 8px; flex-wrap: wrap; }
.su-select, .su-input {
  padding: 8px 10px;
  font-size: 13px;
  font-family: var(--font-body);
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-tx);
  flex: 1;
  min-width: 100px;
}
.su-specs { display: flex; flex-direction: column; gap: 4px; }
.su-specs-label { font-size: 12px; color: var(--color-tx3); }
.rchips { display: flex; flex-wrap: wrap; gap: 6px; }
.rchip {
  font-size: 12px;
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background: rgba(0, 0, 0, 0.2);
  color: var(--color-tx2);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: all 0.15s;
}
.rchip.active { font-weight: 600; }
.wow-ico-sm { width: 14px; height: 14px; border-radius: 2px; }
.su-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}
.su-note {
  flex: 1;
  padding: 6px 10px;
  font-size: 12px;
  font-family: var(--font-body);
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-tx);
}
.btn-signup {
  padding: 8px 16px;
  border-radius: 6px;
  border: none;
  background: linear-gradient(135deg, var(--color-gold), var(--color-gold-dark));
  color: var(--color-bg);
  font: 700 13px var(--font-body);
  cursor: pointer;
  white-space: nowrap;
}
.btn-signup:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-s {
  padding: 6px 14px;
  font-size: 12px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background: none;
  color: var(--color-tx2);
  cursor: pointer;
  white-space: nowrap;
}
.orga-char-preview {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  padding: 6px 10px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.15);
}
.orga-char-cls {
  font-size: 11px;
  font-weight: 400;
  color: var(--color-tx4);
}
</style>
