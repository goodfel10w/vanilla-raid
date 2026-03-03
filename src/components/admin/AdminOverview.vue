<script setup lang="ts">
import { computed } from 'vue'
import { useEntriesStore } from '@/stores/entries'
import { CLS, ROLES, ROLE_COLORS, RR_TANK, RR_HEAL, RR_DPS } from '@/lib/constants'
import type { RoleName } from '@/lib/constants'

const entriesStore = useEntriesStore()

const totalEntries = computed(() => entriesStore.entries.length)

const roleCounts = computed(() => {
  const counts: Record<string, number> = { Tank: 0, Heiler: 0, DPS: 0 }
  entriesStore.entries.forEach(e => {
    (e.roles || []).forEach(r => {
      if (counts[r] !== undefined) counts[r]++
    })
  })
  return counts
})

const classCounts = computed(() => {
  const counts: Record<string, number> = {}
  entriesStore.entries.forEach(e => {
    counts[e.className] = (counts[e.className] || 0) + 1
  })
  return CLS.map(c => ({ name: c.name, color: c.color, count: counts[c.name] || 0 }))
    .sort((a, b) => b.count - a.count)
})

const maxClassCount = computed(() => Math.max(1, ...classCounts.value.map(c => c.count)))

const raidReadiness = computed(() => [
  { role: 'Tank' as RoleName, have: roleCounts.value.Tank, need: RR_TANK },
  { role: 'Heiler' as RoleName, have: roleCounts.value.Heiler, need: RR_HEAL },
  { role: 'DPS' as RoleName, have: roleCounts.value.DPS, need: RR_DPS },
])
</script>

<template>
  <div class="adm-overview">
    <!-- Stats -->
    <div class="adm-stats">
      <div class="adm-stat">
        <div class="adm-stat-val">{{ totalEntries }}</div>
        <div class="adm-stat-lbl">Raider</div>
      </div>
      <div class="adm-stat">
        <div class="adm-stat-val" style="color: var(--role-tank)">{{ roleCounts.Tank }}</div>
        <div class="adm-stat-lbl">Tanks</div>
      </div>
      <div class="adm-stat">
        <div class="adm-stat-val" style="color: var(--role-heal)">{{ roleCounts.Heiler }}</div>
        <div class="adm-stat-lbl">Heiler</div>
      </div>
      <div class="adm-stat">
        <div class="adm-stat-val" style="color: var(--role-dps)">{{ roleCounts.DPS }}</div>
        <div class="adm-stat-lbl">DPS</div>
      </div>
    </div>

    <!-- Class distribution -->
    <div class="card">
      <div class="card-t">Klassenverteilung</div>
      <div
        v-for="c in classCounts"
        :key="c.name"
        class="class-bar-row"
      >
        <span class="class-bar-name" :style="{ color: c.color }">{{ c.name }}</span>
        <div class="class-bar-track">
          <div
            class="class-bar-fill"
            :style="{ width: Math.round(c.count / maxClassCount * 100) + '%', background: c.color, opacity: '0.6' }"
          ></div>
        </div>
        <span class="class-bar-count">{{ c.count }}</span>
      </div>
    </div>

    <!-- Raid readiness -->
    <div class="card">
      <div class="card-t">Raidbereitschaft (25er)</div>
      <div
        v-for="rr in raidReadiness"
        :key="rr.role"
        class="rr-row"
      >
        <span class="rr-label">{{ rr.role }}</span>
        <div class="rr-bar-track">
          <div
            class="rr-bar-fill"
            :style="{
              width: Math.min(Math.round(rr.have / rr.need * 100), 100) + '%',
              background: rr.have >= rr.need ? 'var(--color-success, #66bb6a)' : ROLE_COLORS[rr.role],
              opacity: '0.6',
            }"
          ></div>
        </div>
        <span
          class="rr-count"
          :style="{ color: rr.have >= rr.need ? 'var(--color-success, #66bb6a)' : ROLE_COLORS[rr.role] }"
        >{{ rr.have }} / {{ rr.need }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.adm-stats {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.adm-stat {
  text-align: center;
  padding: 16px 24px;
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  min-width: 80px;
  flex: 1;
}

.adm-stat-val {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-gold);
}

.adm-stat-lbl {
  font-size: 12px;
  color: var(--color-tx3);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.card {
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
}

.card-t {
  font: 600 15px var(--font-heading);
  color: var(--color-gold);
  margin-bottom: 16px;
}

.class-bar-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.class-bar-name {
  min-width: 100px;
  font-size: 13px;
  font-weight: 600;
}

.class-bar-track {
  flex: 1;
  height: 20px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  overflow: hidden;
}

.class-bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s;
}

.class-bar-count {
  min-width: 30px;
  text-align: right;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-tx2);
}

.rr-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.rr-label {
  min-width: 60px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-tx2);
}

.rr-bar-track {
  flex: 1;
  height: 20px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  overflow: hidden;
}

.rr-bar-fill {
  height: 100%;
  border-radius: 4px;
}

.rr-count {
  min-width: 60px;
  text-align: right;
  font-size: 13px;
  font-weight: 600;
}
</style>
