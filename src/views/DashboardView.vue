<script setup lang="ts">
import { computed } from 'vue'
import { useEntriesStore } from '@/stores/entries'
import { CLS, ROLES, ROLE_COLORS, ROLE_ICONS } from '@/lib/constants'
import type { RoleName } from '@/lib/constants'

const entriesStore = useEntriesStore()

const entryCount = computed(() => entriesStore.entries.length)

const roleCounts = computed(() => {
  return ROLES.map(r => ({
    role: r,
    count: entriesStore.entries.filter(e => (e.roles || []).includes(r)).length,
    pct: entriesStore.entries.length
      ? Math.round(
          (entriesStore.entries.filter(e => (e.roles || []).includes(r)).length /
            entriesStore.entries.length) *
            100
        )
      : 0,
  }))
})

const classCounts = computed(() => {
  return CLS.map(c => ({
    ...c,
    count: entriesStore.entries.filter(e => e.className === c.name).length,
  }))
    .filter(c => c.count > 0)
    .sort((a, b) => b.count - a.count)
})

const maxClassCount = computed(() => Math.max(1, ...classCounts.value.map(c => c.count)))

function roleColor(role: RoleName): string {
  return ROLE_COLORS[role]
}

function roleIcon(role: RoleName): string {
  return ROLE_ICONS[role]
}
</script>

<template>
  <div id="v-dashboard">
    <div id="counter" class="counter">
      {{ entryCount }} Raider eingetragen
    </div>

    <!-- Quick Actions -->
    <div class="quick-actions">
      <router-link to="/form" class="qa-link">
        Eintragen
      </router-link>
      <router-link to="/raids" class="qa-link">
        Raids
      </router-link>
      <router-link to="/dkp" class="qa-link">
        DKP
      </router-link>
    </div>

    <template v-if="entryCount > 0">
      <!-- Role Distribution -->
      <div class="card dash-card">
        <div class="card-t">Rollenverteilung</div>
        <div class="role-an">
          <div v-for="rc in roleCounts" :key="rc.role" class="role-an-item">
            <div class="big" :style="{ color: roleColor(rc.role) }">{{ rc.count }}</div>
            <div class="sm">{{ roleIcon(rc.role) }} {{ rc.role }}</div>
            <div class="rprog">
              <div
                class="rprog-f"
                :style="{ width: rc.pct + '%', background: roleColor(rc.role) }"
              ></div>
            </div>
            <div class="pct-label">{{ rc.pct }}%</div>
          </div>
        </div>
      </div>

      <!-- Class Distribution -->
      <div class="card dash-card">
        <div class="card-t">Klassenverteilung</div>
        <div v-for="cls in classCounts" :key="cls.name" class="bar-row">
          <span class="bar-lbl" :style="{ color: cls.color }">{{ cls.name }}</span>
          <div class="bar-track">
            <div
              class="bar-fill"
              :style="{
                width: (cls.count / maxClassCount) * 100 + '%',
                background: cls.color + '40',
              }"
            ></div>
            <span class="bar-val" :style="{ color: cls.color }">{{ cls.count }}&times;</span>
          </div>
        </div>
      </div>
    </template>

    <div v-else class="empty">
      Noch keine Eintr&auml;ge vorhanden.
    </div>
  </div>
</template>

<style scoped>
.counter {
  text-align: center;
  color: var(--color-tx2);
  font-size: 14px;
  margin-bottom: 24px;
}

.quick-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.qa-link {
  padding: 10px 24px;
  border-radius: 8px;
  font: 600 13px var(--font-body);
  background: rgba(201, 168, 76, 0.08);
  border: 1px solid rgba(201, 168, 76, 0.2);
  color: var(--color-gold);
  text-decoration: none;
  transition: all 0.15s;
}

.qa-link:hover {
  background: rgba(201, 168, 76, 0.15);
  border-color: rgba(201, 168, 76, 0.35);
}

.card {
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 20px;
}

.dash-card {
  margin-bottom: 16px;
}

.card-t {
  font: 600 15px var(--font-heading);
  color: var(--color-gold);
  margin-bottom: 16px;
}

.role-an {
  display: flex;
  gap: 16px;
  justify-content: center;
  flex-wrap: wrap;
}

.role-an-item {
  text-align: center;
  min-width: 100px;
}

.role-an-item .big {
  font-size: 28px;
  font-weight: 700;
}

.role-an-item .sm {
  font-size: 12px;
  color: var(--color-tx3);
}

.rprog {
  height: 4px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 2px;
  margin-top: 6px;
  overflow: hidden;
}

.rprog-f {
  height: 100%;
  border-radius: 2px;
  transition: width 0.5s;
}

.pct-label {
  font-size: 10px;
  color: var(--color-tx4);
  margin-top: 3px;
}

.bar-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.bar-lbl {
  font-size: 12px;
  font-weight: 600;
  min-width: 100px;
}

.bar-track {
  flex: 1;
  height: 20px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  position: relative;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 6px;
  transition: width 0.5s;
}

.bar-val {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 11px;
  font-weight: 700;
}

.empty {
  text-align: center;
  padding: 40px 20px;
  color: var(--color-tx3);
  font-size: 14px;
}
</style>
