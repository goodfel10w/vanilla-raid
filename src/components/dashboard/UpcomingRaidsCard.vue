<script setup lang="ts">
import type { Raid } from '@/types'
import { TBC_RAIDS } from '@/lib/constants'

defineProps<{
  raids: Raid[]
}>()

function fmtDate(d: string): string {
  if (!d) return ''
  const [y, m, dd] = d.split('-')
  return `${dd}.${m}.${y}`
}

function tier(instance: string): string {
  return TBC_RAIDS.find(r => r.name === instance)?.tier || '?'
}

function activeCount(raid: Raid): number {
  return (raid.signups || []).filter(
    s => s.status !== 'declined' && s.status !== 'benched'
  ).length
}

function fmtDeadline(dl: string): string {
  if (!dl) return ''
  const d = new Date(dl)
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function deadlinePassed(dl: string): boolean {
  if (!dl) return false
  return new Date() > new Date(dl)
}
</script>

<template>
  <div class="card dash-card">
    <div class="card-t">Kommende Raids</div>
    <div v-if="raids.length === 0" class="empty-hint">
      Keine kommenden Raids geplant
    </div>
    <router-link
      v-for="raid in raids"
      :key="raid.id"
      :to="'/raids/' + raid.id"
      class="ur-raid"
    >
      <div class="ur-top">
        <span class="ur-inst">{{ raid.instance }}</span>
        <span class="ur-tier">{{ tier(raid.instance) }}</span>
        <span v-if="raid.locked" class="ur-locked">Gesperrt</span>
      </div>
      <div class="ur-meta">
        <span>{{ fmtDate(raid.date) }} &middot; {{ raid.time }} Uhr</span>
        <span :class="['ur-slots', activeCount(raid) >= raid.maxPlayers ? 'full' : '']">
          {{ activeCount(raid) }}/{{ raid.maxPlayers }} angemeldet
        </span>
      </div>
      <div v-if="raid.deadline" :class="['ur-deadline', deadlinePassed(raid.deadline) ? 'past' : '']">
        Anmeldefrist: {{ fmtDeadline(raid.deadline) }}
        <span v-if="deadlinePassed(raid.deadline)"> (abgelaufen)</span>
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
.empty-hint {
  font-size: 13px;
  color: var(--color-tx3);
  text-align: center;
  padding: 12px 0;
}
.ur-raid {
  display: block;
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.02);
  margin-bottom: 8px;
  text-decoration: none;
  color: inherit;
  transition: background 0.15s;
}
.ur-raid:last-child { margin-bottom: 0; }
.ur-raid:hover { background: rgba(201, 168, 76, 0.06); }
.ur-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  flex-wrap: wrap;
}
.ur-inst {
  font: 600 14px var(--font-heading);
  color: var(--color-gold);
}
.ur-tier {
  font-size: 10px;
  color: var(--color-tx3);
  padding: 1px 6px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.04);
}
.ur-locked {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  margin-left: auto;
  background: rgba(229, 115, 115, 0.12);
  color: var(--color-dps);
}
.ur-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: var(--color-tx3);
}
.ur-slots {
  font-weight: 600;
  color: var(--color-tx2);
}
.ur-slots.full {
  color: var(--color-dps);
}
.ur-deadline {
  font-size: 11px;
  color: var(--color-tx4);
  margin-top: 4px;
}
.ur-deadline.past {
  color: var(--color-dps);
  opacity: 0.7;
}
</style>
