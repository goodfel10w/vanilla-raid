<script setup lang="ts">
import { computed } from 'vue'
import { DAY_SHORT } from '@/lib/constants'
import type { AvailabilityMap, AvailabilityValue } from '@/types'

const props = defineProps<{
  days: string[]
  modelValue: AvailabilityMap
  entryAvailability: AvailabilityMap
}>()

const emit = defineEmits<{
  'update:modelValue': [value: AvailabilityMap]
}>()

// Evening-focused slots: 17:00–23:45 in 30-min increments for compactness
const TIME_SLOTS: string[] = []
for (let hh = 17; hh < 24; hh++) {
  for (let mm = 0; mm < 60; mm += 30) {
    TIME_SLOTS.push(String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'))
  }
}

const activeDays = computed(() => props.days.filter(d => DAY_SHORT[d]))

function cellState(day: string, slot: string): AvailabilityValue | '' {
  const key = `${day}_${slot}`
  if (props.modelValue[key]) return props.modelValue[key]
  // Show entry availability as ghost
  return ''
}

function entryHas(day: string, slot: string): AvailabilityValue | '' {
  // Check the 15-min sub-slots within this 30-min slot
  const [hh, mm] = slot.split(':').map(Number)
  const keys = [
    `${day}_${slot}`,
    `${day}_${String(hh).padStart(2, '0')}:${String(mm + 15).padStart(2, '0')}`,
  ]
  const vals = keys.map(k => props.entryAvailability[k]).filter(Boolean)
  if (vals.length === 0) return ''
  return vals.includes('yes') ? 'yes' : 'tentative'
}

function toggleCell(day: string, slot: string) {
  const key = `${day}_${slot}`
  const next = { ...props.modelValue }
  const current = next[key]
  // Also need to set the 15-min sub-slot
  const [hh, mm] = slot.split(':').map(Number)
  const subKey = `${day}_${String(hh).padStart(2, '0')}:${String(mm + 15).padStart(2, '0')}`

  if (!current) {
    next[key] = 'yes'
    next[subKey] = 'yes'
  } else if (current === 'yes') {
    next[key] = 'tentative'
    next[subKey] = 'tentative'
  } else {
    delete next[key]
    delete next[subKey]
  }
  emit('update:modelValue', next)
}

function prefillFromEntry() {
  const next: AvailabilityMap = {}
  for (const day of props.days) {
    for (const slot of TIME_SLOTS) {
      const [hh, mm] = slot.split(':').map(Number)
      const key1 = `${day}_${slot}`
      const key2 = `${day}_${String(hh).padStart(2, '0')}:${String(mm + 15).padStart(2, '0')}`
      if (props.entryAvailability[key1]) next[key1] = props.entryAvailability[key1]
      if (props.entryAvailability[key2]) next[key2] = props.entryAvailability[key2]
    }
  }
  emit('update:modelValue', next)
}

defineExpose({ prefillFromEntry })
</script>

<template>
  <div class="kstg">
    <div class="kstg-hint">
      Klicke auf Zellen: leer → verfügbar → unsicher → leer
    </div>
    <div class="kstg-grid">
      <div class="kstg-corner"></div>
      <div v-for="day in activeDays" :key="day" class="kstg-dh">{{ DAY_SHORT[day] }}</div>

      <template v-for="slot in TIME_SLOTS" :key="slot">
        <div class="kstg-th">{{ slot }}</div>
        <div
          v-for="day in activeDays"
          :key="day + slot"
          class="kstg-cell"
          :class="{
            'kstg-yes': cellState(day, slot) === 'yes',
            'kstg-tent': cellState(day, slot) === 'tentative',
            'kstg-ghost': !cellState(day, slot) && entryHas(day, slot),
          }"
          @click="toggleCell(day, slot)"
        ></div>
      </template>
    </div>
    <button class="kstg-prefill" type="button" @click="prefillFromEntry">
      Aus Profil übernehmen
    </button>
  </div>
</template>

<style scoped>
.kstg { margin-top: 8px; }

.kstg-hint {
  font-size: 11px;
  color: var(--color-tx4);
  margin-bottom: 6px;
}

.kstg-grid {
  display: grid;
  grid-template-columns: 44px repeat(v-bind('activeDays.length'), 1fr);
  gap: 2px;
}

.kstg-corner { }

.kstg-dh {
  font: 600 11px var(--font-body);
  color: var(--color-gold);
  text-align: center;
  padding: 2px 0;
}

.kstg-th {
  font-size: 10px;
  color: var(--color-tx4);
  text-align: right;
  padding-right: 4px;
  line-height: 22px;
}

.kstg-cell {
  height: 22px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.03);
  cursor: pointer;
  transition: background 0.1s;
}

.kstg-cell:hover { background: rgba(255, 255, 255, 0.08); }
.kstg-cell.kstg-yes { background: rgba(102, 187, 106, 0.5); }
.kstg-cell.kstg-tent { background: rgba(229, 194, 68, 0.4); }
.kstg-cell.kstg-ghost { background: rgba(102, 187, 106, 0.12); }

.kstg-prefill {
  margin-top: 8px;
  font-size: 11px;
  color: var(--color-gold);
  background: none;
  border: 1px solid rgba(201, 168, 76, 0.2);
  border-radius: 6px;
  padding: 4px 10px;
  cursor: pointer;
  transition: all 0.15s;
}
.kstg-prefill:hover {
  background: rgba(201, 168, 76, 0.08);
  border-color: rgba(201, 168, 76, 0.35);
}
</style>
