<script setup lang="ts">
import type { MyRaidInfo } from '@/composables/useDashboardData'
import ClassIcon from '@/components/shared/ClassIcon.vue'
import { cc, timeAgo } from '@/lib/utils'

defineProps<{
  raids: MyRaidInfo[]
}>()

function fmtDate(d: string): string {
  if (!d) return ''
  const [y, m, dd] = d.split('-')
  return `${dd}.${m}.${y}`
}

function statusLabel(status: string): string {
  switch (status) {
    case 'confirmed': return 'Bestätigt'
    case 'accepted': return 'Angenommen'
    case 'tentative': return 'Unsicher'
    case 'declined': return 'Abgesagt'
    case 'bench': case 'benched': return 'Bank'
    default: return status
  }
}

function statusClass(status: string): string {
  switch (status) {
    case 'confirmed': case 'accepted': return 'st-confirmed'
    case 'tentative': return 'st-tentative'
    case 'bench': case 'benched': return 'st-benched'
    case 'declined': return 'st-declined'
    default: return ''
  }
}
</script>

<template>
  <div class="card dash-card">
    <div class="card-t">Meine Raids diese Woche</div>
    <div v-if="raids.length === 0" class="empty-hint">
      Keine Raid-Anmeldungen diese Woche
    </div>
    <router-link
      v-for="ri in raids"
      :key="ri.raid.id"
      :to="'/raids/' + ri.raid.id"
      class="my-raid"
    >
      <div class="mr-left">
        <ClassIcon :class-name="ri.signup.className" size="sm" />
        <div>
          <div class="mr-inst">{{ ri.raid.instance }}</div>
          <div class="mr-meta">
            <span :style="{ color: cc(ri.signup.className) }">{{ ri.signup.charName }}</span>
            &middot; {{ fmtDate(ri.raid.date) }} &middot; {{ ri.raid.time }} Uhr
            <span v-if="ri.signup.timestamp" class="mr-ago">&middot; {{ timeAgo(ri.signup.timestamp) }}</span>
          </div>
        </div>
      </div>
      <span :class="['st-badge', statusClass(ri.signup.status)]">
        {{ statusLabel(ri.signup.status) }}
      </span>
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
.my-raid {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.02);
  margin-bottom: 8px;
  text-decoration: none;
  color: inherit;
  transition: background 0.15s;
}
.my-raid:last-child { margin-bottom: 0; }
.my-raid:hover { background: rgba(201, 168, 76, 0.06); }
.mr-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.mr-inst {
  font: 600 14px var(--font-heading);
  color: var(--color-gold);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mr-meta {
  font-size: 12px;
  color: var(--color-tx3);
}
.st-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 4px;
  white-space: nowrap;
  flex-shrink: 0;
}
.st-confirmed { background: rgba(102, 187, 106, 0.12); color: var(--color-heal); }
.st-tentative { background: rgba(229, 194, 68, 0.12); color: var(--color-ylw); }
.st-benched { background: rgba(229, 115, 115, 0.12); color: var(--color-dps); }
.st-declined { background: rgba(255, 255, 255, 0.04); color: var(--color-tx4); }
.mr-ago {
  color: var(--color-tx4);
  font-size: 11px;
}
</style>
