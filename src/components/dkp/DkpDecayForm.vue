<script setup lang="ts">
import { ref, computed } from 'vue'
import { useDkpStore } from '@/stores/dkp'
import { useUiStore } from '@/stores/ui'
import { useToast } from '@/composables/useToast'
import ConfirmModal from '@/components/shared/ConfirmModal.vue'

const dkp = useDkpStore()
const ui = useUiStore()
const { toast } = useToast()

const decayPercent = ref(dkp.config.defaultDecayPercent || 15)
const showConfirm = ref(false)
const submitting = ref(false)

const totalDkp = computed(() => dkp.balances.reduce((s, b) => s + Math.max(0, b.balance), 0))
const decayTotal = computed(() => Math.round(totalDkp.value * decayPercent.value / 100))

const positivePlayers = computed(() => dkp.balances.filter(b => b.balance > 0))

const previewPlayers = computed(() =>
  positivePlayers.value.slice(0, 5).map(b => ({
    name: b.playerName,
    before: b.balance,
    after: b.balance - Math.round(b.balance * decayPercent.value / 100),
    loss: Math.round(b.balance * decayPercent.value / 100),
  }))
)

const remainingCount = computed(() => Math.max(0, positivePlayers.value.length - 5))

function requestDecay() {
  showConfirm.value = true
}

async function doDecay() {
  if (submitting.value) return
  submitting.value = true
  try {
    await dkp.decay(decayPercent.value)
    toast(`${decayPercent.value}% Verfall angewendet`)
    ui.dkpView = 'overview'
    showConfirm.value = false
  } catch (e: unknown) {
    toast('Fehler: ' + (e instanceof Error ? e.message : 'Unbekannter Fehler'))
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="card dkp-form" style="padding:28px">
    <div class="card-t">Wöchentlicher Verfall</div>
    <p style="font-size:13px;color:var(--color-tx3);margin-bottom:16px">
      Reduziert alle positiven DKP-Stände um einen Prozentsatz. Empfohlen: 10–20% pro Woche.
    </p>

    <div class="fld">
      <span class="lbl">Verfall-Prozent</span>
      <input
        id="dkp-decay-pct"
        v-model.number="decayPercent"
        type="number"
        placeholder="z.B. 15"
        min="1"
        max="100"
      >
    </div>

    <div v-if="dkp.balances.length" class="dkp-decay-preview">
      <strong>Vorschau:</strong> {{ decayPercent }}% von {{ totalDkp }} DKP =
      <span style="color:var(--color-yellow, #ffd54f)">&minus;{{ decayTotal }} DKP</span> gesamt
      <template v-for="p in previewPlayers" :key="p.name">
        <br>{{ p.name }}: {{ p.before }} &rarr; {{ p.after }} (&minus;{{ p.loss }})
      </template>
      <template v-if="remainingCount > 0">
        <br><span style="color:var(--color-tx4)">... und {{ remainingCount }} weitere</span>
      </template>
    </div>

    <div class="brow" style="margin-top:16px">
      <button
        class="btn-p decay-btn"
        :disabled="!dkp.balances.length || submitting"
        @click="requestDecay"
      >Verfall anwenden</button>
    </div>
  </div>

  <ConfirmModal
    :open="showConfirm"
    title="Verfall anwenden"
    :message="`Wirklich <strong>${decayPercent}%</strong> Verfall auf alle DKP-Stände anwenden?`"
    confirm-label="Anwenden"
    @confirm="doDecay"
    @cancel="showConfirm = false"
  />
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

.fld input {
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

.fld input:focus {
  border-color: rgba(201, 168, 76, 0.4);
}

.dkp-decay-preview {
  font-size: 13px;
  color: var(--color-tx3);
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  padding: 12px 14px;
  line-height: 1.8;
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

.decay-btn {
  background: linear-gradient(135deg, var(--color-yellow, #ffd54f), #c9a020);
}

.btn-p:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-p:not(:disabled):hover {
  filter: brightness(1.1);
}
</style>
