<script setup lang="ts">
import { ref, computed } from 'vue'
import { useDkpStore } from '@/stores/dkp'
import { useUiStore } from '@/stores/ui'
import { useToast } from '@/composables/useToast'

const dkp = useDkpStore()
const ui = useUiStore()
const { toast } = useToast()

const spendPlayer = ref('')
const spendAmount = ref('')
const spendItem = ref('')
const submitting = ref(false)

const playersWithDkp = computed(() => dkp.balances)

const canSubmit = computed(() => spendPlayer.value && spendAmount.value)

async function doSpend() {
  if (!canSubmit.value || submitting.value) return
  submitting.value = true
  try {
    await dkp.spend(spendPlayer.value, Number(spendAmount.value), spendItem.value || 'Loot')
    toast(`${spendAmount.value} DKP für ${spendItem.value || 'Loot'} verbucht`)
    spendPlayer.value = ''
    spendAmount.value = ''
    spendItem.value = ''
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
    <div class="card-t">Beute verteilen (DKP ausgeben)</div>

    <div class="fld">
      <span class="lbl">Spieler</span>
      <select id="dkp-spend-player" v-model="spendPlayer">
        <option value="">— Spieler wählen —</option>
        <option
          v-for="b in playersWithDkp"
          :key="b.playerName"
          :value="b.playerName"
        >{{ b.playerName }} ({{ b.balance }} DKP)</option>
      </select>
    </div>

    <div class="fld">
      <span class="lbl">DKP-Kosten</span>
      <input
        id="dkp-spend-amount"
        v-model="spendAmount"
        type="number"
        placeholder="z.B. 25"
        min="1"
        :max="dkp.config.maxDkpAmount"
      >
    </div>

    <div class="fld">
      <span class="lbl">Gegenstand</span>
      <input
        id="dkp-spend-item"
        v-model="spendItem"
        type="text"
        placeholder="z.B. [Dragonspine Trophy]"
        :maxlength="dkp.config.reasonMaxLength || 200"
      >
      <span class="lbl-s" style="margin-top:4px">[Item Name] in Klammern = Wowhead-Link mit Icon</span>
    </div>

    <div class="brow">
      <button
        id="dkp-spend-btn"
        class="btn-p"
        :disabled="!canSubmit || submitting"
        @click="doSpend"
      >Beute verbuchen</button>
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

.lbl-s {
  display: block;
  font-size: 11px;
  color: var(--color-tx4);
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
  appearance: none;
  -webkit-appearance: none;
  cursor: pointer;
}

.fld input:focus,
.fld select:focus {
  border-color: rgba(201, 168, 76, 0.4);
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
