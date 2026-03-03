<script setup lang="ts">
import { ref, computed } from 'vue'
import { useEntriesStore } from '@/stores/entries'
import { useDkpStore } from '@/stores/dkp'
import { useRaidsStore } from '@/stores/raids'
import { useUiStore } from '@/stores/ui'
import { cc } from '@/lib/utils'
import { formatDate } from '@/lib/utils'
import { useToast } from '@/composables/useToast'

const entries = useEntriesStore()
const dkp = useDkpStore()
const raids = useRaidsStore()
const ui = useUiStore()
const { toast } = useToast()

const awardPlayers = ref<{ name: string; className: string }[]>([])
const awardAmount = ref('')
const awardReason = ref('')
const awardRaidId = ref('')
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

const previewTotal = computed(() => {
  if (!awardPlayers.value.length || !awardAmount.value) return 0
  return awardPlayers.value.length * Number(awardAmount.value)
})

const canSubmit = computed(() =>
  awardPlayers.value.length > 0 && awardAmount.value && awardReason.value
)

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
  if (awardPlayers.value.length === entries.entries.length) {
    awardPlayers.value = []
  } else {
    awardPlayers.value = entries.entries.map(e => ({ name: e.charName, className: e.className }))
  }
  awardRaidId.value = ''
}

function selectRaid(raidId: string) {
  awardRaidId.value = raidId
  if (!raidId) {
    awardPlayers.value = []
    awardReason.value = ''
    return
  }
  const raid = raids.raids.find(r => r.id === raidId)
  if (!raid) return
  const signups = (raid.signups || []).filter(s => s.status !== 'declined' && s.status !== 'benched')
  awardPlayers.value = signups.map(s => ({ name: s.charName, className: s.className || '' }))
  awardReason.value = raid.instance + ' \u2014 ' + formatDate(raid.date)
}

function isSelected(name: string) {
  return awardPlayers.value.some(p => p.name === name)
}

async function doAward() {
  if (!canSubmit.value || submitting.value) return
  submitting.value = true
  try {
    await dkp.award(awardPlayers.value, Number(awardAmount.value), awardReason.value)
    toast(`${awardPlayers.value.length}\u00D7 ${awardAmount.value} DKP vergeben`)
    awardPlayers.value = []
    awardAmount.value = ''
    awardReason.value = ''
    awardRaidId.value = ''
    ui.dkpView = 'overview'
  } catch (e: any) {
    toast('Fehler: ' + e.message)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="card dkp-form" style="padding:28px">
    <div class="card-t">DKP vergeben</div>

    <!-- Raid picker -->
    <div v-if="pastRaids.length" class="dkp-raid-picker">
      <div class="fld">
        <span class="lbl">Aus Raid übernehmen</span>
        <select @change="selectRaid(($event.target as HTMLSelectElement).value)">
          <option value="">— Manuell auswählen —</option>
          <option
            v-for="r in pastRaids"
            :key="r.id"
            :value="r.id"
            :selected="awardRaidId === r.id"
          >{{ r.instance }} — {{ formatDate(r.date) }} {{ r.time }} ({{ (r.signups || []).filter(s => s.status !== 'declined' && s.status !== 'benched').length }} Spieler)</option>
        </select>
        <div v-if="awardRaidId" class="dkp-raid-hint">Spieler und Grund aus Raid übernommen. Du kannst Spieler manuell an-/abwählen.</div>
      </div>
    </div>

    <!-- Player chips -->
    <div class="fld">
      <span class="lbl">Spieler auswählen <span class="dkp-selectall" @click="selectAll">Alle</span></span>
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

    <!-- Amount -->
    <div class="fld">
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
      v-if="awardPlayers.length && awardAmount"
      id="dkp-award-preview"
      style="font-size:12px;color:var(--color-tx3);margin-bottom:12px"
    >
      {{ awardPlayers.length }} Spieler &times; {{ awardAmount }} DKP =
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
</style>
