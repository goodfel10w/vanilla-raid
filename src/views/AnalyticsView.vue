<script setup lang="ts">
import { computed } from 'vue'
import { useEntriesStore } from '@/stores/entries'
import { ROLES, ROLE_COLORS, ROLE_ICONS, DAY_SHORT } from '@/lib/constants'
import type { RoleName } from '@/lib/constants'
import { cc, h } from '@/lib/utils'
import { useAnalyticsData } from '@/composables/useAnalyticsData'
import EmptyState from '@/components/shared/EmptyState.vue'

const entriesStore = useEntriesStore()
const {
  roleCounts,
  multiSpecCount,
  singleSpecCount,
  classCounts,
  maxClassCount,
  bestSlots,
  playerSlotCounts,
  maxPlayerSlots,
  playersForSlot,
  isRaidReady,
} = useAnalyticsData(() => entriesStore.entries)

interface RoleBreakdown {
  role: RoleName
  icon: string
  color: string
  players: { charName: string; className: string; _availType: string }[]
}

function roleBreakdownForSlot(day: string, hourLabel: string): RoleBreakdown[] {
  const players = playersForSlot(day, hourLabel)
  return ROLES.map(r => ({
    role: r,
    icon: ROLE_ICONS[r],
    color: ROLE_COLORS[r],
    players: players.filter(p => (p.roles || []).includes(r)),
  }))
}
</script>

<template>
  <div id="v-analytics">
    <EmptyState v-if="!entriesStore.entries.length" message="Noch keine Daten f&uuml;r die Auswertung." />

    <template v-if="entriesStore.entries.length">
      <!-- Role distribution -->
      <div class="card">
        <div class="card-t">Rollenverteilung</div>
        <div class="role-an">
          <div v-for="rc in roleCounts" :key="rc.role" class="role-an-item">
            <div class="big" :style="{ color: rc.color }">{{ rc.count }}</div>
            <div class="sm">{{ rc.icon }} {{ rc.role }}</div>
            <div class="rprog">
              <div class="rprog-f" :style="{ width: rc.pct + '%', background: rc.color }"></div>
            </div>
            <div style="font-size:10px;color:var(--color-tx4);margin-top:3px">{{ rc.pct }}%</div>
          </div>
        </div>
        <div class="flex-info">
          {{ multiSpecCount }} Spieler mit Mehrfach-Spec &middot; {{ singleSpecCount }} nur ein Spec
        </div>
      </div>

      <!-- Class distribution -->
      <div class="card">
        <div class="card-t">Klassenverteilung</div>
        <div v-for="cls in classCounts" :key="cls.name" class="bar-row">
          <span class="bar-lbl" :style="{ color: cls.color }">{{ cls.name }}</span>
          <div class="bar-track">
            <div
              class="bar-fill"
              :style="{ width: (cls.count / maxClassCount * 100) + '%', background: cls.color + '40' }"
            ></div>
            <span class="bar-val" :style="{ color: cls.color }">{{ cls.count }}&times;</span>
          </div>
        </div>
      </div>

      <!-- Best raid times -->
      <div class="card">
        <div class="card-t">Beste Raidzeiten &mdash; Details</div>
        <div
          v-for="slot in bestSlots"
          :key="slot.key"
          class="bs-card"
          :style="{
            background: slot.rank === 1 ? 'rgba(201,168,76,.06)' : 'rgba(255,255,255,.015)',
            border: '1px solid ' + (slot.rank === 1 ? 'rgba(201,168,76,.2)' : 'rgba(255,255,255,.04)'),
          }"
        >
          <div class="bs-hdr">
            <span class="rank" :style="{ color: slot.rank === 1 ? 'var(--color-gold)' : '#9a92a8' }">
              #{{ slot.rank }} {{ slot.day }} {{ slot.time }}:00
            </span>
            <span class="avail">
              {{ slot.total }} verf&uuml;gbar{{ slot.tent > 0 ? ` (${slot.tent} vielleicht)` : '' }}
            </span>
            <span
              v-if="isRaidReady(playersForSlot(slot.day, slot.time)).ready"
              class="badge-rr"
            >Raid-Ready!</span>
          </div>
          <div class="bs-roles">
            <div v-for="rb in roleBreakdownForSlot(slot.day, slot.time)" :key="rb.role" class="bs-role">
              <div class="bs-role-t" :style="{ color: rb.color }">
                {{ rb.icon }} {{ rb.role }} ({{ rb.players.length }})
              </div>
              <template v-if="rb.players.length">
                <div
                  v-for="p in rb.players"
                  :key="p.charName"
                  class="bs-player"
                  :style="{ color: p._availType === 'tentative' ? 'var(--color-yellow)' : cc(p.className) }"
                >{{ p._availType === 'tentative' ? '(?) ' : '' }}{{ p.charName }}</div>
              </template>
              <div v-else style="font-size:11px;color:var(--color-tx5)">&mdash;</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Player availability ranking -->
      <div class="card">
        <div class="card-t">Verf&uuml;gbarkeit pro Spieler</div>
        <div v-for="p in playerSlotCounts" :key="p.charName" class="pbar-row">
          <span class="pbar-name" :style="{ color: p.color }">{{ p.charName }}</span>
          <div class="pbar-track">
            <div class="pbar-fill" :style="{ width: (p.slotCount / maxPlayerSlots * 100) + '%' }"></div>
          </div>
          <span class="pbar-val">{{ p.slotCount }} Slots</span>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.card {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 18px;
  margin-bottom: 16px;
}

.card-t {
  font-family: var(--font-heading);
  font-size: 15px;
  font-weight: 700;
  color: var(--color-tx);
  margin-bottom: 14px;
}

/* Role distribution */
.role-an {
  display: flex;
  justify-content: space-around;
  gap: 16px;
  margin-bottom: 12px;
}

.role-an-item {
  text-align: center;
  flex: 1;
}

.big {
  font-size: 28px;
  font-weight: 800;
  font-family: var(--font-heading);
}

.sm {
  font-size: 12px;
  color: var(--color-tx3);
  margin: 4px 0;
}

.rprog {
  height: 4px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 2px;
  overflow: hidden;
}

.rprog-f {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s;
}

.flex-info {
  font-size: 12px;
  color: var(--color-tx4);
  text-align: center;
  margin-top: 8px;
}

/* Class distribution bars */
.bar-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.bar-lbl {
  font-size: 12px;
  font-weight: 600;
  width: 110px;
  flex-shrink: 0;
  text-align: right;
}

.bar-track {
  flex: 1;
  height: 22px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 4px;
  position: relative;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s;
}

.bar-val {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 11px;
  font-weight: 700;
}

/* Best raid times */
.bs-card {
  border-radius: 10px;
  padding: 14px 16px;
  margin-bottom: 10px;
}

.bs-hdr {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.rank {
  font-weight: 700;
  font-size: 14px;
}

.avail {
  font-size: 12px;
  color: var(--color-tx3);
}

.badge-rr {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(102, 187, 106, 0.15);
  color: var(--color-green, #66bb6a);
}

.bs-roles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 10px;
}

.bs-role {
  font-size: 12px;
}

.bs-role-t {
  font-weight: 700;
  font-size: 11px;
  margin-bottom: 4px;
}

.bs-player {
  font-size: 11px;
  padding: 1px 0;
}

/* Player availability */
.pbar-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.pbar-name {
  font-size: 12px;
  font-weight: 600;
  width: 110px;
  flex-shrink: 0;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pbar-track {
  flex: 1;
  height: 14px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 3px;
  overflow: hidden;
}

.pbar-fill {
  height: 100%;
  background: rgba(201, 168, 76, 0.25);
  border-radius: 3px;
  transition: width 0.3s;
}

.pbar-val {
  font-size: 11px;
  color: var(--color-tx4);
  width: 65px;
  text-align: right;
  flex-shrink: 0;
}
</style>
