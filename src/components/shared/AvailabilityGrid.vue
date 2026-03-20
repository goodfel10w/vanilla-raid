<script setup lang="ts">
import { ref } from 'vue'
import { DAYS, SLOTS, HOUR_LABELS, DAY_SHORT } from '@/lib/constants'
import type { AvailabilityMap, AvailabilityValue } from '@/types'

const props = defineProps<{
  modelValue: AvailabilityMap
}>()

const emit = defineEmits<{
  'update:modelValue': [value: AvailabilityMap]
}>()

// Drag-to-paint state
const painting = ref(false)
const paintState = ref<AvailabilityValue | null>(null)

function getCellClass(key: string, slotIndex: number): string {
  const classes = ['tl-cell']
  if (slotIndex % 4 === 0) classes.push('hstart')
  const v = props.modelValue[key]
  if (v === 'yes') classes.push('on')
  else if (v === 'tentative') classes.push('tent')
  return classes.join(' ')
}

function cycleCell(key: string) {
  const current = props.modelValue[key]
  const newAvail = { ...props.modelValue }
  if (!current) {
    newAvail[key] = 'yes'
    paintState.value = 'yes'
  } else if (current === 'yes') {
    newAvail[key] = 'tentative'
    paintState.value = 'tentative'
  } else {
    delete newAvail[key]
    paintState.value = null
  }
  emit('update:modelValue', newAvail)
}

function applyPaint(key: string) {
  const newAvail = { ...props.modelValue }
  if (paintState.value === null) {
    delete newAvail[key]
  } else {
    newAvail[key] = paintState.value
  }
  emit('update:modelValue', newAvail)
}

function onMouseDown(key: string) {
  painting.value = true
  cycleCell(key)
}

function onMouseEnter(key: string) {
  if (painting.value) {
    applyPaint(key)
  }
}

function onMouseUp() {
  painting.value = false
}

function onTouchStart(key: string, e: TouchEvent) {
  e.preventDefault()
  painting.value = true
  cycleCell(key)
}

function onTouchMove(e: TouchEvent) {
  if (!painting.value) return
  const touch = e.touches[0]
  const el = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement | null
  if (el?.dataset.k) {
    applyPaint(el.dataset.k)
  }
}
</script>

<template>
  <div class="tl-wrap" @mouseup="onMouseUp" @mouseleave="onMouseUp" @touchend="onMouseUp">
    <table class="tl-table">
      <thead>
        <tr>
          <th></th>
          <th v-for="hl in HOUR_LABELS" :key="hl" colspan="4">{{ hl }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="day in DAYS" :key="day">
          <td class="dl">{{ DAY_SHORT[day] }}</td>
          <td
            v-for="(slot, i) in SLOTS"
            :key="slot"
            :class="getCellClass(day + '_' + slot, i)"
            :data-k="day + '_' + slot"
            @mousedown.prevent="onMouseDown(day + '_' + slot)"
            @mouseenter="onMouseEnter(day + '_' + slot)"
            @touchstart="onTouchStart(day + '_' + slot, $event)"
            @touchmove="onTouchMove"
          ></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.tl-wrap {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 4px;
}

.tl-table {
  border-collapse: collapse;
  user-select: none;
}

.tl-table th {
  font-size: 10px;
  color: var(--color-tx4);
  padding: 2px 0;
  text-align: center;
  font-weight: 500;
}

.dl {
  font-size: 13px;
  color: #9a92a8;
  padding: 4px 8px 4px 0;
  font-weight: 500;
  white-space: nowrap;
  text-align: left;
  position: sticky;
  left: 0;
  background: var(--color-bg2);
  z-index: 1;
}

.tl-cell {
  width: 14px;
  min-width: 14px;
  height: 32px;
  border: 1px solid rgba(255, 255, 255, 0.03);
  cursor: pointer;
  background: rgba(0, 0, 0, 0.2);
  transition: background 0.1s;
  padding: 0;
}

.tl-cell.hstart {
  border-left: 2px solid rgba(255, 255, 255, 0.1);
}

.tl-cell.on {
  background: var(--color-green-bg);
  border-color: var(--color-green-border);
}

.tl-cell.tent {
  background: var(--color-yellow-bg);
  border-color: var(--color-yellow-border);
}

.tl-cell:hover {
  background: rgba(255, 255, 255, 0.06);
}

.tl-cell.on:hover {
  background: rgba(76, 175, 80, 0.25);
}

.tl-cell.tent:hover {
  background: rgba(229, 194, 68, 0.25);
}

@media (max-width: 767px) {
  .tl-cell {
    width: 24px;
    min-width: 24px;
    height: 38px;
  }

  .tl-table th {
    font-size: 9px;
  }

  .dl {
    font-size: 11px;
    padding-right: 4px;
  }
}
</style>
