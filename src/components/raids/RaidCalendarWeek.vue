<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Raid } from '@/types'

const props = defineProps<{
  raids: Raid[]
}>()

const emit = defineEmits<{
  selectRaid: [id: string]
}>()

const DAY_FULL = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']
const calDate = ref(new Date())

const weekRange = computed(() => {
  const ref = new Date(calDate.value)
  const day = ref.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const mon = new Date(ref)
  mon.setDate(ref.getDate() + diff)
  mon.setHours(0, 0, 0, 0)
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  return { mon, sun }
})

const weekTitle = computed(() => {
  const { mon, sun } = weekRange.value
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(mon.getDate())}.${pad(mon.getMonth() + 1)}. -- ${pad(sun.getDate())}.${pad(sun.getMonth() + 1)}.${sun.getFullYear()}`
})

const todayStr = computed(() => {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
})

const days = computed(() => {
  const { mon } = weekRange.value
  const result: { date: Date; ds: string; isToday: boolean; raids: Raid[] }[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(mon)
    d.setDate(mon.getDate() + i)
    const ds = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
    result.push({
      date: d,
      ds,
      isToday: ds === todayStr.value,
      raids: props.raids.filter(r => r.date === ds).sort((a, b) => a.time.localeCompare(b.time)),
    })
  }
  return result
})

function prevWeek() {
  const d = new Date(calDate.value)
  d.setDate(d.getDate() - 7)
  calDate.value = d
}
function nextWeek() {
  const d = new Date(calDate.value)
  d.setDate(d.getDate() + 7)
  calDate.value = d
}
function goToday() {
  calDate.value = new Date()
}

function signupCount(raid: Raid): number {
  return (raid.signups || []).filter(s => s.status !== 'declined').length
}

function fillColor(raid: Raid): string {
  const count = signupCount(raid)
  if (count >= raid.maxPlayers) return 'var(--color-heal)'
  const pct = Math.round(count / raid.maxPlayers * 100)
  if (pct >= 60) return 'var(--color-ylw)'
  return 'var(--color-tx3)'
}

function sizeClass(raid: Raid): string {
  return raid.maxPlayers <= 10 ? 'r10' : 'r25'
}
</script>

<template>
  <div class="cal-week">
    <div class="cal-nav">
      <button class="cal-nav-btn" @click="prevWeek">&lsaquo;</button>
      <span class="cal-title">{{ weekTitle }}</span>
      <button class="cal-nav-btn" @click="nextWeek">&rsaquo;</button>
      <button class="cal-nav-btn" @click="goToday">Heute</button>
    </div>

    <div
      v-for="day in days"
      :key="day.ds"
      :class="['cal-week-row', { today: day.isToday }]"
    >
      <div class="cal-week-hdr">
        <span class="cal-week-day">{{ DAY_FULL[day.date.getDay()] }}</span>
        <span class="cal-week-day-date">
          {{ String(day.date.getDate()).padStart(2, '0') }}.{{ String(day.date.getMonth() + 1).padStart(2, '0') }}.
        </span>
        <span v-if="!day.raids.length" class="cal-week-noraids">Keine Raids</span>
      </div>
      <div v-if="day.raids.length" class="cal-week-raids">
        <div
          v-for="r in day.raids"
          :key="r.id"
          :class="['cal-week-card', sizeClass(r)]"
          @click="emit('selectRaid', r.id)"
        >
          <span class="cal-week-inst">{{ r.instance }}</span>
          <div class="cal-week-meta">
            <span>{{ r.time }} Uhr</span>
            <span>{{ r.maxPlayers }} Spieler</span>
          </div>
          <span class="cal-week-signup" :style="{ color: fillColor(r) }">
            {{ signupCount(r) }}/{{ r.maxPlayers }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cal-week { margin-top: 12px; }
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
.cal-week-row {
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  padding: 10px 0;
}
.cal-week-row.today {
  background: rgba(201, 168, 76, 0.04);
  border-radius: 8px;
  padding: 10px;
}
.cal-week-hdr {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.cal-week-day { font-weight: 600; font-size: 13px; color: var(--color-tx); }
.cal-week-day-date { font-size: 12px; color: var(--color-tx3); }
.cal-week-noraids { font-size: 12px; color: var(--color-tx4); font-style: italic; }
.cal-week-raids { display: flex; gap: 8px; flex-wrap: wrap; }
.cal-week-card {
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 10px 14px;
  cursor: pointer;
  min-width: 180px;
  transition: border-color 0.15s;
}
.cal-week-card:hover { border-color: rgba(201, 168, 76, 0.35); }
.cal-week-card.r10 { border-left: 3px solid var(--color-gold); }
.cal-week-card.r25 { border-left: 3px solid var(--color-heal); }
.cal-week-inst {
  font: 600 13px var(--font-heading);
  color: var(--color-gold);
  display: block;
  margin-bottom: 4px;
}
.cal-week-meta {
  display: flex;
  gap: 10px;
  font-size: 11px;
  color: var(--color-tx3);
  margin-bottom: 4px;
}
.cal-week-signup {
  font-size: 12px;
  font-weight: 700;
}
</style>
