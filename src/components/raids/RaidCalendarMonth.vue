<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Raid } from '@/types'

const props = defineProps<{
  raids: Raid[]
}>()

const emit = defineEmits<{
  selectRaid: [id: string]
}>()

const MONTH_NAMES = ['Januar', 'Februar', 'Maerz', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
const DAY_HDR = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

const calDate = ref(new Date())

const year = computed(() => calDate.value.getFullYear())
const month = computed(() => calDate.value.getMonth())

const todayStr = computed(() => {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
})

interface CalDay {
  dayNum: number
  ds: string
  isToday: boolean
  isOther: boolean
  raids: Raid[]
}

const calDays = computed(() => {
  const y = year.value
  const m = month.value
  const days: CalDay[] = []

  const first = new Date(y, m, 1)
  let startDow = first.getDay() - 1
  if (startDow < 0) startDow = 6

  const daysInMonth = new Date(y, m + 1, 0).getDate()

  // Previous month fill
  const prevMonthDays = new Date(y, m, 0).getDate()
  for (let i = startDow - 1; i >= 0; i--) {
    const d = prevMonthDays - i
    const pm = m === 0 ? 11 : m - 1
    const py = m === 0 ? y - 1 : y
    const ds = py + '-' + String(pm + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0')
    days.push({
      dayNum: d,
      ds,
      isToday: ds === todayStr.value,
      isOther: true,
      raids: props.raids.filter(r => r.date === ds),
    })
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0')
    days.push({
      dayNum: d,
      ds,
      isToday: ds === todayStr.value,
      isOther: false,
      raids: props.raids.filter(r => r.date === ds).sort((a, b) => a.time.localeCompare(b.time)),
    })
  }

  // Trailing fill
  const totalCells = startDow + daysInMonth
  const rem = totalCells % 7
  if (rem > 0) {
    const nm = m === 11 ? 0 : m + 1
    const ny = m === 11 ? y + 1 : y
    for (let d = 1; d <= 7 - rem; d++) {
      const ds = ny + '-' + String(nm + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0')
      days.push({
        dayNum: d,
        ds,
        isToday: ds === todayStr.value,
        isOther: true,
        raids: props.raids.filter(r => r.date === ds),
      })
    }
  }

  return days
})

function prevMonth() {
  const d = new Date(calDate.value)
  d.setMonth(d.getMonth() - 1)
  calDate.value = d
}
function nextMonth() {
  const d = new Date(calDate.value)
  d.setMonth(d.getMonth() + 1)
  calDate.value = d
}
function goToday() {
  calDate.value = new Date()
}

function signupCount(raid: Raid): number {
  return (raid.signups || []).filter(s => s.status !== 'declined').length
}

function sizeClass(raid: Raid): string {
  return raid.maxPlayers <= 10 ? 'r10' : 'r25'
}
</script>

<template>
  <div class="cal-month">
    <div class="cal-nav">
      <button class="cal-nav-btn" @click="prevMonth">&lsaquo;</button>
      <span class="cal-title">{{ MONTH_NAMES[month] }} {{ year }}</span>
      <button class="cal-nav-btn" @click="nextMonth">&rsaquo;</button>
      <button class="cal-nav-btn" @click="goToday">Heute</button>
    </div>

    <div class="cal-grid">
      <div v-for="dh in DAY_HDR" :key="dh" class="cal-hdr">{{ dh }}</div>
      <div
        v-for="(day, idx) in calDays"
        :key="idx"
        :class="['cal-day', { today: day.isToday, 'other-month': day.isOther }]"
      >
        <div class="cal-day-num">{{ day.dayNum }}</div>
        <div
          v-for="r in day.raids"
          :key="r.id"
          :class="['cal-raid', sizeClass(r)]"
          :title="`${r.instance} -- ${r.time} Uhr -- ${signupCount(r)}/${r.maxPlayers}`"
          @click="emit('selectRaid', r.id)"
        >
          <span class="cal-raid-time">{{ r.time }}</span>
          {{ r.instance }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cal-month { margin-top: 12px; }
.cal-nav {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.cal-nav-btn {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background: none;
  color: var(--color-tx2);
  cursor: pointer;
  font-size: 14px;
}
.cal-nav-btn:hover { background: rgba(255, 255, 255, 0.05); }
.cal-title {
  font: 600 14px var(--font-heading);
  color: var(--color-gold);
}
.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}
.cal-hdr {
  text-align: center;
  font-size: 11px;
  font-weight: 700;
  color: var(--color-tx3);
  padding: 6px 0;
}
.cal-day {
  min-height: 70px;
  background: var(--color-card);
  border: 1px solid rgba(255, 255, 255, 0.03);
  border-radius: 4px;
  padding: 4px;
  overflow: hidden;
}
.cal-day.today {
  border-color: rgba(201, 168, 76, 0.3);
  background: rgba(201, 168, 76, 0.04);
}
.cal-day.other-month {
  opacity: 0.4;
}
.cal-day-num {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-tx3);
  margin-bottom: 2px;
}
.cal-raid {
  font-size: 10px;
  padding: 2px 4px;
  border-radius: 3px;
  cursor: pointer;
  margin-bottom: 2px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--color-tx);
}
.cal-raid.r10 { background: rgba(201, 168, 76, 0.12); }
.cal-raid.r25 { background: rgba(102, 187, 106, 0.12); }
.cal-raid:hover { filter: brightness(1.2); }
.cal-raid-time {
  font-weight: 700;
  color: var(--color-tx3);
  margin-right: 2px;
}

@media (max-width: 640px) {
  .cal-day { min-height: 50px; }
  .cal-raid { font-size: 9px; }
}
</style>
