<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useEntriesStore } from '@/stores/entries'
import { useDkpStore } from '@/stores/dkp'
import { useRaidsStore } from '@/stores/raids'
import { useUiStore } from '@/stores/ui'
import { cc } from '@/lib/utils'
import { formatDate } from '@/lib/utils'
import { useToast } from '@/composables/useToast'
import { TBC_RAIDS } from '@/lib/constants'
import type { TbcBoss } from '@/lib/constants'

const entries = useEntriesStore()
const dkp = useDkpStore()
const raids = useRaidsStore()
const ui = useUiStore()
const { toast } = useToast()

const awardPlayers = ref<{ name: string; className: string }[]>([])
const awardAmount = ref('')
const awardReason = ref('')
const selectedRaidIds = ref<string[]>([])
const selectedBosses = ref<{ instance: string; boss: string; dkp: number }[]>([])
const useBossMode = ref(false)
const submitting = ref(false)

const players = computed(() =>
  entries.entries.map(e => ({ name: e.charName, className: e.className }))
)

const pastRaids = computed(() =>
  raids.raids
    .filter(r => {
      const rDate = new Date(r.date + 'T' + (r.time || '00:00'))
      return rDate < new Date()
    })
    .sort((a, b) => (b.date + 'T' + b.time).localeCompare(a.date + 'T' + a.time))
)

// Get unique instance names from selected raids for boss display
const selectedInstances = computed(() => {
  const instances: { name: string; bosses: TbcBoss[]; raidDate: string }[] = []
  const seen = new Set<string>()
  for (const raidId of selectedRaidIds.value) {
    const raid = raids.raids.find(r => r.id === raidId)
    if (!raid) continue
    const tbcRaid = TBC_RAIDS.find(t => t.name === raid.instance)
    if (!tbcRaid?.bosses?.length) continue
    // Use instance+date as key so same instance on different dates shows separately
    const key = raid.instance
    if (seen.has(key)) continue
    seen.add(key)
    instances.push({ name: raid.instance, bosses: tbcRaid.bosses, raidDate: raid.date })
  }
  return instances
})

const bossDkpTotal = computed(() =>
  selectedBosses.value.reduce((sum, b) => sum + b.dkp, 0)
)

const previewTotal = computed(() => {
  if (!awardPlayers.value.length) return 0
  const amount = useBossMode.value ? bossDkpTotal.value : Number(awardAmount.value)
  if (!amount) return 0
  return awardPlayers.value.length * amount
})

const canSubmit = computed(() => {
  if (!awardPlayers.value.length) return false
  if (useBossMode.value) {
    return selectedBosses.value.length > 0
  }
  return !!(awardAmount.value && awardReason.value)
})

function togglePlayer(name: string) {
  const idx = awardPlayers.value.findIndex(p => p.name === name)
  if (idx >= 0) {
    awardPlayers.value.splice(idx, 1)
  } else {
    const e = entries.entries.find(x => x.charName === name)
    awardPlayers.value.push({ name, className: e?.className || '' })
  }
}

function selectAll() {
  if (awardPlayers.value.length === players.value.length) {
    awardPlayers.value = []
  } else {
    awardPlayers.value = players.value.map(p => ({ ...p }))
  }
}

function toggleRaid(raidId: string) {
  const idx = selectedRaidIds.value.indexOf(raidId)
  if (idx >= 0) {
    selectedRaidIds.value.splice(idx, 1)
  } else {
    selectedRaidIds.value.push(raidId)
  }
  syncPlayersFromRaids()
  syncReasonFromSelection()
}

function syncPlayersFromRaids() {
  if (!selectedRaidIds.value.length) {
    awardPlayers.value = []
    return
  }
  // Merge signups from all selected raids, dedup by name
  const merged = new Map<string, { name: string; className: string }>()
  for (const raidId of selectedRaidIds.value) {
    const raid = raids.raids.find(r => r.id === raidId)
    if (!raid) continue
    for (const s of (raid.signups || []).filter(s => s.status !== 'declined' && s.status !== 'benched')) {
      if (!merged.has(s.charName)) {
        merged.set(s.charName, { name: s.charName, className: s.className || '' })
      }
    }
  }
  awardPlayers.value = Array.from(merged.values())
}

function syncReasonFromSelection() {
  if (!selectedRaidIds.value.length) {
    awardReason.value = ''
    return
  }
  const parts: string[] = []
  const dates = new Set<string>()
  for (const raidId of selectedRaidIds.value) {
    const raid = raids.raids.find(r => r.id === raidId)
    if (!raid) continue
    parts.push(raid.instance)
    dates.add(formatDate(raid.date))
  }
  awardReason.value = parts.join(' + ') + ' \u2014 ' + Array.from(dates).join(', ')
}

function toggleBoss(instance: string, boss: TbcBoss) {
  const idx = selectedBosses.value.findIndex(b => b.instance === instance && b.boss === boss.name)
  if (idx >= 0) {
    selectedBosses.value.splice(idx, 1)
  } else {
    selectedBosses.value.push({ instance, boss: boss.name, dkp: boss.dkp })
  }
  // Update reason to reflect kills
  if (useBossMode.value) {
    buildBossReason()
  }
}

function isBossSelected(instance: string, bossName: string) {
  return selectedBosses.value.some(b => b.instance === instance && b.boss === bossName)
}

function selectAllBosses(instance: string, bosses: TbcBoss[]) {
  const allSelected = bosses.every(b => isBossSelected(instance, b.name))
  if (allSelected) {
    selectedBosses.value = selectedBosses.value.filter(b => b.instance !== instance)
  } else {
    // Add missing bosses
    for (const boss of bosses) {
      if (!isBossSelected(instance, boss.name)) {
        selectedBosses.value.push({ instance, boss: boss.name, dkp: boss.dkp })
      }
    }
  }
  if (useBossMode.value) {
    buildBossReason()
  }
}

function areAllBossesSelected(instance: string, bosses: TbcBoss[]) {
  return bosses.every(b => isBossSelected(instance, b.name))
}

function buildBossReason() {
  if (!selectedBosses.value.length) {
    awardReason.value = ''
    return
  }
  // Group by instance
  const grouped = new Map<string, string[]>()
  for (const b of selectedBosses.value) {
    if (!grouped.has(b.instance)) grouped.set(b.instance, [])
    grouped.get(b.instance)!.push(b.boss)
  }
  const parts: string[] = []
  for (const [inst, bosses] of grouped) {
    const tbcRaid = TBC_RAIDS.find(t => t.name === inst)
    const allKilled = tbcRaid?.bosses?.length === bosses.length
    if (allKilled) {
      parts.push(inst + ' (Full Clear)')
    } else {
      parts.push(inst + ': ' + bosses.join(', '))
    }
  }
  const dates = new Set<string>()
  for (const raidId of selectedRaidIds.value) {
    const raid = raids.raids.find(r => r.id === raidId)
    if (raid) dates.add(formatDate(raid.date))
  }
  const dateStr = dates.size ? ' \u2014 ' + Array.from(dates).join(', ') : ''
  awardReason.value = parts.join(' + ') + dateStr
}

// When boss mode is toggled, rebuild reason
watch(useBossMode, (val) => {
  if (val) {
    buildBossReason()
  } else {
    syncReasonFromSelection()
  }
})

function isSelected(name: string) {
  return awardPlayers.value.some(p => p.name === name)
}

async function doAward() {
  if (!canSubmit.value || submitting.value) return
  submitting.value = true
  const amount = useBossMode.value ? bossDkpTotal.value : Number(awardAmount.value)
  const reason = awardReason.value
  try {
    await dkp.award(awardPlayers.value, amount, reason)
    toast(`${awardPlayers.value.length}\u00D7 ${amount} DKP vergeben`)
    awardPlayers.value = []
    awardAmount.value = ''
    awardReason.value = ''
    selectedRaidIds.value = []
    selectedBosses.value = []
    useBossMode.value = false
    ui.dkpView = 'overview'
  } catch (e: unknown) {
    toast('Fehler: ' + (e instanceof Error ? e.message : 'Unbekannter Fehler'))
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="card dkp-form" style="padding:28px">
    <div class="card-t">DKP vergeben</div>

    <!-- Raid picker: multi-select -->
    <div v-if="pastRaids.length" class="dkp-raid-picker">
      <div class="fld">
        <span class="lbl">Raids auswählen (mehrere kombinierbar)</span>
        <div class="raid-chips">
          <div
            v-for="r in pastRaids"
            :key="r.id"
            class="raid-chip"
            :class="{ active: selectedRaidIds.includes(r.id) }"
            @click="toggleRaid(r.id)"
          >
            <span class="raid-chip-name">{{ r.instance }}</span>
            <span class="raid-chip-meta">{{ formatDate(r.date) }} {{ r.time }}</span>
            <span class="raid-chip-count">{{ (r.signups || []).filter(s => s.status !== 'declined' && s.status !== 'benched').length }} Spieler</span>
          </div>
        </div>
        <div v-if="selectedRaidIds.length > 1" class="dkp-raid-hint">
          {{ selectedRaidIds.length }} Raids kombiniert — Spieler zusammengeführt ({{ awardPlayers.length }} Spieler).
        </div>
        <div v-else-if="selectedRaidIds.length === 1" class="dkp-raid-hint">
          Spieler aus Raid übernommen. Du kannst Spieler manuell an-/abwählen.
        </div>
      </div>
    </div>

    <!-- Boss kill mode toggle -->
    <div v-if="selectedInstances.length" class="fld">
      <label class="boss-mode-toggle">
        <input
          type="checkbox"
          :checked="useBossMode"
          @change="useBossMode = ($event.target as HTMLInputElement).checked"
        >
        <span>Boss-Kills auswählen (DKP pro Boss)</span>
      </label>
    </div>

    <!-- Boss kill selection -->
    <div v-if="useBossMode && selectedInstances.length" class="fld">
      <div v-for="inst in selectedInstances" :key="inst.name" class="boss-instance">
        <div class="boss-instance-header">
          <span class="boss-instance-name">{{ inst.name }}</span>
          <span
            class="dkp-selectall"
            @click="selectAllBosses(inst.name, inst.bosses)"
          >{{ areAllBossesSelected(inst.name, inst.bosses) ? 'Keine' : 'Alle' }}</span>
        </div>
        <div class="boss-chips">
          <div
            v-for="boss in inst.bosses"
            :key="boss.name"
            class="boss-chip"
            :class="{ active: isBossSelected(inst.name, boss.name) }"
            @click="toggleBoss(inst.name, boss)"
          >
            <span class="boss-chip-name">{{ boss.name }}</span>
            <span class="boss-chip-dkp">{{ boss.dkp }} DKP</span>
          </div>
        </div>
      </div>

      <!-- Boss DKP total -->
      <div v-if="selectedBosses.length" class="boss-total">
        {{ selectedBosses.length }} Bosse = <strong>{{ bossDkpTotal }} DKP</strong> pro Spieler
      </div>
    </div>

    <!-- Player chips -->
    <div class="fld">
      <span class="lbl">Spieler auswählen <span class="dkp-selectall" @click="selectAll">{{ awardPlayers.length === players.length ? 'Keine' : 'Alle' }}</span></span>
      <div class="dkp-pchips">
        <template v-if="players.length">
          <div
            v-for="p in players"
            :key="p.name"
            class="dkp-pchip"
            :class="{ active: isSelected(p.name) }"
            :style="isSelected(p.name) ? { color: cc(p.className), borderColor: cc(p.className) } : {}"
            @click="togglePlayer(p.name)"
          >{{ p.name }}</div>
        </template>
        <div v-else style="font-size:12px;color:var(--color-tx4)">Keine Spieler im Kader. Erst Einträge erstellen.</div>
      </div>
    </div>

    <!-- Amount (manual mode only) -->
    <div v-if="!useBossMode" class="fld">
      <span class="lbl">DKP-Betrag</span>
      <input
        id="dkp-award-amount"
        v-model="awardAmount"
        type="number"
        placeholder="z.B. 10"
        min="1"
        :max="dkp.config.maxDkpAmount"
      >
    </div>

    <!-- Reason -->
    <div class="fld">
      <span class="lbl">Grund</span>
      <input
        id="dkp-award-reason"
        v-model="awardReason"
        type="text"
        placeholder="z.B. Gruul Kill, Pünktlichkeitsbonus"
        :maxlength="dkp.config.reasonMaxLength || 200"
      >
    </div>

    <!-- Preview -->
    <div
      v-if="awardPlayers.length && (useBossMode ? bossDkpTotal : Number(awardAmount))"
      id="dkp-award-preview"
      style="font-size:12px;color:var(--color-tx3);margin-bottom:12px"
    >
      {{ awardPlayers.length }} Spieler &times; {{ useBossMode ? bossDkpTotal : awardAmount }} DKP =
      <strong style="color:var(--color-green)">{{ previewTotal }} DKP</strong> gesamt
    </div>

    <!-- Submit -->
    <div class="brow">
      <button
        id="dkp-award-btn"
        class="btn-p"
        :disabled="!canSubmit || submitting"
        @click="doAward"
      >Vergeben</button>
    </div>
  </div>
</template>

<style scoped>
.card {
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
}

.card-t {
  font: 600 15px var(--font-heading);
  color: var(--color-gold);
  margin-bottom: 16px;
}

.fld {
  margin-bottom: 14px;
}

.lbl {
  display: block;
  font-size: 12px;
  color: var(--color-tx3);
  margin-bottom: 6px;
}

.dkp-selectall {
  color: var(--color-gold);
  cursor: pointer;
  font-weight: 600;
  margin-left: 8px;
}

.dkp-selectall:hover {
  text-decoration: underline;
}

.dkp-pchips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.dkp-pchip {
  padding: 5px 12px;
  border-radius: 16px;
  border: 1px solid var(--color-border);
  font-size: 12px;
  color: var(--color-tx3);
  cursor: pointer;
  transition: all 0.15s;
  user-select: none;
}

.dkp-pchip:hover {
  background: rgba(255, 255, 255, 0.05);
}

.dkp-pchip.active {
  background: rgba(255, 255, 255, 0.06);
  font-weight: 600;
}

.fld input,
.fld select {
  display: block;
  width: 100%;
  padding: 10px 14px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  color: var(--color-tx);
  font: 15px var(--font-body);
  outline: none;
}

.fld input:focus,
.fld select:focus {
  border-color: rgba(201, 168, 76, 0.4);
}

.dkp-raid-hint {
  font-size: 11px;
  color: var(--color-tx4);
  margin-top: 6px;
}

.brow {
  display: flex;
  gap: 10px;
}

.btn-p {
  padding: 12px 28px;
  border-radius: 8px;
  border: none;
  background: linear-gradient(135deg, var(--color-gold), var(--color-gold-dark, #a88430));
  color: var(--color-bg, #0d0c14);
  cursor: pointer;
  font: 700 14px var(--font-body);
  transition: all 0.15s;
}

.btn-p:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-p:not(:disabled):hover {
  filter: brightness(1.1);
}

/* Raid multi-select chips */
.raid-chips {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 240px;
  overflow-y: auto;
}

.raid-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  cursor: pointer;
  transition: all 0.15s;
  user-select: none;
  font-size: 13px;
}

.raid-chip:hover {
  background: rgba(255, 255, 255, 0.04);
}

.raid-chip.active {
  border-color: var(--color-gold);
  background: rgba(201, 168, 76, 0.08);
}

.raid-chip-name {
  font-weight: 600;
  color: var(--color-tx);
}

.raid-chip-meta {
  color: var(--color-tx4);
  font-size: 12px;
}

.raid-chip-count {
  margin-left: auto;
  color: var(--color-tx4);
  font-size: 11px;
}

/* Boss mode toggle */
.boss-mode-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 13px;
  color: var(--color-tx2);
}

.boss-mode-toggle input {
  width: 16px;
  height: 16px;
  accent-color: var(--color-gold);
  cursor: pointer;
}

/* Boss selection */
.boss-instance {
  margin-bottom: 12px;
}

.boss-instance-header {
  display: flex;
  align-items: center;
  margin-bottom: 6px;
}

.boss-instance-name {
  font: 600 13px var(--font-heading);
  color: var(--color-gold);
}

.boss-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.boss-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  cursor: pointer;
  transition: all 0.15s;
  user-select: none;
  min-width: 80px;
}

.boss-chip:hover {
  background: rgba(255, 255, 255, 0.05);
}

.boss-chip.active {
  border-color: var(--color-green, #66bb6a);
  background: rgba(102, 187, 106, 0.1);
}

.boss-chip-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-tx);
}

.boss-chip-dkp {
  font-size: 10px;
  color: var(--color-tx4);
}

.boss-chip.active .boss-chip-dkp {
  color: var(--color-green, #66bb6a);
}

.boss-total {
  margin-top: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(102, 187, 106, 0.08);
  font-size: 13px;
  color: var(--color-tx3);
}

.boss-total strong {
  color: var(--color-green, #66bb6a);
}
</style>
