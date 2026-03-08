<script setup lang="ts">
import type { DashboardNotification } from '@/composables/useDashboardData'

defineProps<{
  notifications: DashboardNotification[]
}>()
</script>

<template>
  <div class="card dash-card">
    <div class="card-t">Neuigkeiten</div>
    <div
      v-for="(n, i) in notifications"
      :key="i"
      :class="['notif', n.type]"
    >
      <span class="notif-icon">{{ n.type === 'confirmed' ? '✓' : '⏸' }}</span>
      <router-link :to="'/raids/' + n.raidId" class="notif-msg">
        {{ n.message }}
      </router-link>
    </div>
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
.notif {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  margin-bottom: 8px;
  border-left: 3px solid transparent;
}
.notif:last-child { margin-bottom: 0; }
.notif.confirmed {
  background: rgba(102, 187, 106, 0.06);
  border-left-color: var(--color-heal);
}
.notif.benched {
  background: rgba(229, 115, 115, 0.06);
  border-left-color: var(--color-dps);
}
.notif-icon {
  font-size: 14px;
  flex-shrink: 0;
}
.notif.confirmed .notif-icon { color: var(--color-heal); }
.notif.benched .notif-icon { color: var(--color-dps); }
.notif-msg {
  font-size: 13px;
  color: var(--color-tx2);
  text-decoration: none;
}
.notif-msg:hover { color: var(--color-gold); }
</style>
