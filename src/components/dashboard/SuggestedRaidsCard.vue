<script setup lang="ts">
import type { SuggestedRaid } from '@/composables/useDashboardData'
import { TBC_RAIDS } from '@/lib/constants'

defineProps<{
  raids: SuggestedRaid[]
}>()

function fmtDate(d: string): string {
  if (!d) return ''
  const [y, m, dd] = d.split('-')
  return `${dd}.${m}.${y}`
}

function tier(instance: string): string {
  return TBC_RAIDS.find(r => r.name === instance)?.tier || '?'
}
</script>

<template>
  <div class="card dash-card">
    <div class="card-t">Passende Raids</div>
    <router-link
      v-for="sr in raids"
      :key="sr.raid.id"
      :to="'/raids/' + sr.raid.id"
      class="sug-raid"
    >
      <div class="sr-top">
        <span class="sr-inst">{{ sr.raid.instance }}</span>
        <span class="sr-tier">{{ tier(sr.raid.instance) }}</span>
        <span :class="['sr-match', sr.matchType]">
          {{ sr.matchType === 'yes' ? 'Verfügbar' : 'Evtl. verfügbar' }}
        </span>
      </div>
      <div class="sr-meta">
        <span>{{ fmtDate(sr.raid.date) }} &middot; {{ sr.raid.time }} Uhr</span>
        <span :class="['sr-slots', sr.openSlots <= 0 ? 'full' : '']">
          {{ sr.openSlots > 0 ? sr.openSlots + ' Plätze frei' : 'Voll' }}
        </span>
      </div>
    </router-link>
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
  margin-bottom: 16px;
}
.sug-raid {
  display: block;
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.02);
  margin-bottom: 8px;
  text-decoration: none;
  color: inherit;
  transition: background 0.15s;
}
.sug-raid:last-child { margin-bottom: 0; }
.sug-raid:hover { background: rgba(201, 168, 76, 0.06); }
.sr-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  flex-wrap: wrap;
}
.sr-inst {
  font: 600 14px var(--font-heading);
  color: var(--color-gold);
}
.sr-tier {
  font-size: 10px;
  color: var(--color-tx3);
  padding: 1px 6px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.04);
}
.sr-match {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  margin-left: auto;
}
.sr-match.yes {
  background: rgba(102, 187, 106, 0.12);
  color: var(--color-heal);
}
.sr-match.tentative {
  background: rgba(229, 194, 68, 0.12);
  color: var(--color-ylw);
}
.sr-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: var(--color-tx3);
}
.sr-slots {
  font-weight: 600;
  color: var(--color-tx2);
}
.sr-slots.full {
  color: var(--color-dps);
}
</style>
