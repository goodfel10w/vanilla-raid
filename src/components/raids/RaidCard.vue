<script setup lang="ts">
import { computed } from 'vue'
import type { Raid } from '@/types'
import type { RoleName } from '@/lib/constants'
import { TBC_RAIDS, ROLES, ROLE_COLORS, ROLE_ICONS, RR_TANK, RR_HEAL, RR_DPS } from '@/lib/constants'
import { cc } from '@/lib/utils'
import ClassIcon from '@/components/shared/ClassIcon.vue'

const props = defineProps<{
  raid: Raid
  isPast?: boolean
}>()

const emit = defineEmits<{
  click: [id: string]
}>()

const inst = computed(() =>
  TBC_RAIDS.find(i => i.name === props.raid.instance) || { name: props.raid.instance, tier: '?' }
)

const activeSignups = computed(() =>
  (props.raid.signups || []).filter(s => s.status !== 'declined' && s.status !== 'benched')
)

const tentativeCount = computed(() =>
  activeSignups.value.filter(s => s.status === 'tentative').length
)

const confirmedCount = computed(() =>
  activeSignups.value.filter(s => s.status === 'confirmed').length
)

const acceptedCount = computed(() =>
  activeSignups.value.filter(s => s.status === 'accepted' || s.status === 'confirmed').length
)

const total = computed(() => activeSignups.value.length)
const pct = computed(() => Math.min(100, Math.round(total.value / props.raid.maxPlayers * 100)))

const barClass = computed(() => {
  if (total.value > props.raid.maxPlayers) return 'over'
  if (total.value === props.raid.maxPlayers) return 'full'
  return ''
})

const is10 = computed(() => props.raid.maxPlayers <= 10)

const roleCounts = computed(() => {
  const counts: Record<RoleName, number> = { Tank: 0, Heiler: 0, DPS: 0 }
  activeSignups.value.forEach(s => {
    if (s.role === 'Tank') counts.Tank++
    else if (s.role === 'Heiler') counts.Heiler++
    else counts.DPS++
  })
  return counts
})

const roleTargets = computed(() => ({
  Tank: is10.value ? 2 : RR_TANK,
  Heiler: is10.value ? 2 : RR_HEAL,
  DPS: is10.value ? 6 : RR_DPS,
}))

const deadlinePassed = computed(() =>
  props.raid.deadline ? new Date() > new Date(props.raid.deadline) : false
)

function fmtDate(d: string): string {
  if (!d) return ''
  const [y, m, dd] = d.split('-')
  return `${dd}.${m}.${y}`
}

function fmtDeadline(dl: string): string {
  const d = new Date(dl)
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div
    :class="['raid-card', { past: isPast }]"
    :id="'raid-' + raid.id"
    @click="emit('click', raid.id)"
  >
    <div class="raid-hdr">
      <span class="raid-inst">{{ raid.instance }}</span>
      <span class="raid-tier">{{ inst.tier }}</span>
      <span v-if="tentativeCount" class="raid-tent-badge">
        {{ tentativeCount }} unsicher
      </span>
    </div>

    <div class="raid-meta">
      <span>{{ fmtDate(raid.date) }}</span>
      <span>{{ raid.time }} Uhr</span>
      <span>
        <template v-if="confirmedCount">
          <span style="color: var(--color-heal)">{{ confirmedCount }}</span>&nbsp;
        </template>
        <strong>{{ acceptedCount }}</strong>
        <template v-if="tentativeCount">
          <span style="color: var(--color-ylw)">+{{ tentativeCount }}</span>
        </template>
        / {{ raid.maxPlayers }}
      </span>
      <span v-if="raid.createdByName" class="raid-creator">von {{ raid.createdByName }}</span>
    </div>

    <div class="raid-bar">
      <div :class="['raid-bar-fill', barClass]" :style="{ width: pct + '%' }"></div>
    </div>

    <div class="raid-roles">
      <span :style="{ background: ROLE_COLORS.Tank + '18', color: ROLE_COLORS.Tank }">
        {{ ROLE_ICONS.Tank }} {{ roleCounts.Tank }}{{ is10 ? '' : '/' + roleTargets.Tank }} Tank
      </span>
      <span :style="{ background: ROLE_COLORS.Heiler + '18', color: ROLE_COLORS.Heiler }">
        {{ ROLE_ICONS.Heiler }} {{ roleCounts.Heiler }}{{ is10 ? '' : '/' + roleTargets.Heiler }} Heiler
      </span>
      <span :style="{ background: ROLE_COLORS.DPS + '18', color: ROLE_COLORS.DPS }">
        {{ ROLE_ICONS.DPS }} {{ roleCounts.DPS }}{{ is10 ? '' : '/' + roleTargets.DPS }} DPS
      </span>
    </div>

    <div v-if="raid.locked" class="raid-deadline closed">
      <span>Raid gesperrt</span>
      <span class="dl-badge closed">Gesperrt</span>
    </div>
    <div v-else-if="raid.deadline" :class="['raid-deadline', deadlinePassed ? 'closed' : 'open']">
      <span>Anmeldefrist: {{ fmtDeadline(raid.deadline) }}</span>
      <span :class="['dl-badge', deadlinePassed ? 'closed' : 'open']">
        {{ deadlinePassed ? 'Geschlossen' : 'Offen' }}
      </span>
    </div>

    <div v-if="raid.description" class="raid-desc">{{ raid.description }}</div>
    <div v-if="raid.notes" class="raid-notes">{{ raid.notes }}</div>
  </div>
</template>

<style scoped>
.raid-card {
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 18px 20px;
  cursor: pointer;
  transition: border-color 0.15s, transform 0.1s;
}
.raid-card:hover {
  border-color: rgba(201, 168, 76, 0.35);
}
.raid-card.past {
  opacity: 0.5;
}
.raid-hdr {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.raid-inst {
  font: 700 16px var(--font-heading);
  color: var(--color-gold);
}
.raid-tier {
  font-size: 11px;
  color: var(--color-tx3);
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.04);
}
.raid-tent-badge {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(229, 194, 68, 0.1);
  color: var(--color-ylw);
  font-weight: 600;
}
.raid-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 13px;
  color: var(--color-tx2);
  margin-bottom: 10px;
}
.raid-creator {
  font-size: 11px;
  color: var(--color-tx4);
}
.raid-bar {
  height: 6px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 10px;
}
.raid-bar-fill {
  height: 100%;
  border-radius: 3px;
  background: var(--color-gold);
  transition: width 0.4s;
}
.raid-bar-fill.full { background: var(--color-heal); }
.raid-bar-fill.over { background: var(--color-dps); }
.raid-roles {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.raid-roles span {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 4px;
  font-weight: 600;
}
.raid-deadline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 6px;
  margin-bottom: 6px;
}
.raid-deadline.open {
  background: rgba(102, 187, 106, 0.06);
  color: var(--color-heal);
}
.raid-deadline.closed {
  background: rgba(229, 115, 115, 0.06);
  color: var(--color-dps);
}
.dl-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 3px;
}
.dl-badge.open { background: rgba(102, 187, 106, 0.15); }
.dl-badge.closed { background: rgba(229, 115, 115, 0.15); }
.raid-desc {
  font-size: 12px;
  color: var(--color-tx2);
  margin-bottom: 4px;
}
.raid-notes {
  font-size: 12px;
  color: var(--color-tx3);
  font-style: italic;
  padding: 6px 10px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.1);
}
</style>
