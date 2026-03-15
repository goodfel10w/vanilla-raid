<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useDkpStore } from '@/stores/dkp'
import { useToast } from '@/composables/useToast'
import { useDkpRole } from '@/composables/useDkpRole'
import { linkItems } from '@/lib/utils'
import type { DkpTransaction } from '@/types'
import DkpActionsBar from '@/components/dkp/DkpActionsBar.vue'
import DkpStandings from '@/components/dkp/DkpStandings.vue'
import DkpAwardForm from '@/components/dkp/DkpAwardForm.vue'
import DkpSpendForm from '@/components/dkp/DkpSpendForm.vue'
import DkpDecayForm from '@/components/dkp/DkpDecayForm.vue'
import DkpSettings from '@/components/dkp/DkpSettings.vue'
import ConfirmModal from '@/components/shared/ConfirmModal.vue'
import { ref } from 'vue'

const ui = useUiStore()
const dkp = useDkpStore()
const { toast } = useToast()
const { isDkpAdmin: isAdmin, isDkpOfficer: isOfficer } = useDkpRole()

// Undo modal
const showUndoModal = ref(false)
const lastTx = computed(() => dkp.transactions[0])
const undoMessage = computed(() => {
  const tx = lastTx.value
  if (!tx) return ''
  const typeLabel = tx.type === 'earn' ? 'Verdient' : tx.type === 'spend' ? 'Beute' : 'Verfall'
  const amtStr = tx.amount > 0 ? '+' + tx.amount : String(tx.amount)
  const reason = tx.type === 'spend' ? linkItems(tx.reason) : tx.reason
  return `<strong>${typeLabel}</strong>: ${tx.playerName} ${amtStr} DKP — „${reason}"<br><br>Diese Aktion macht die Transaktion rückgängig und stellt den vorherigen DKP-Stand wieder her.`
})

function handleUndo() {
  showUndoModal.value = true
}

async function doUndo() {
  if (!lastTx.value) return
  try {
    await dkp.undo(lastTx.value.id)
    toast('Transaktion rückgängig gemacht')
    showUndoModal.value = false
  } catch (e: unknown) {
    toast('Fehler: ' + (e instanceof Error ? e.message : 'Unbekannter Fehler'))
  }
}

// Edit/Delete transaction modals
const showEditTxModal = ref(false)
const editingTx = ref<DkpTransaction | null>(null)
const editTxAmount = ref(0)
const editTxReason = ref('')

const showDeleteTxModal = ref(false)
const deletingTxId = ref('')

function handleEditTx(txId: string) {
  const tx = dkp.transactions.find(t => t.id === txId)
  if (!tx) return
  editingTx.value = tx
  editTxAmount.value = Math.abs(tx.amount)
  editTxReason.value = tx.reason
  showEditTxModal.value = true
}

async function doEditTx() {
  if (!editingTx.value || !editTxAmount.value || editTxAmount.value <= 0) { toast('Ungültiger Betrag'); return }
  try {
    await dkp.editTransaction(editingTx.value.id, editTxAmount.value, editTxReason.value)
    toast('Transaktion aktualisiert')
    showEditTxModal.value = false
  } catch (e: unknown) {
    toast('Fehler: ' + (e instanceof Error ? e.message : 'Unbekannter Fehler'))
  }
}

function handleDeleteTx(txId: string) {
  deletingTxId.value = txId
  showDeleteTxModal.value = true
}

async function doDeleteTx() {
  try {
    await dkp.deleteTransaction(deletingTxId.value)
    toast('Transaktion gelöscht')
    showDeleteTxModal.value = false
  } catch (e: unknown) {
    toast('Fehler: ' + (e instanceof Error ? e.message : 'Unbekannter Fehler'))
  }
}

const deleteTxMessage = computed(() => {
  const tx = dkp.transactions.find(t => t.id === deletingTxId.value)
  if (!tx) return ''
  const typeLabel = tx.type === 'earn' ? 'Verdient' : tx.type === 'spend' ? 'Beute' : tx.type === 'adjust' ? 'Anpassung' : 'Verfall'
  const amtStr = tx.amount > 0 ? '+' + tx.amount : String(tx.amount)
  const reason = tx.type === 'spend' ? linkItems(tx.reason) : tx.reason
  return `<strong>${typeLabel}</strong>: ${tx.playerName} ${amtStr} DKP — „${reason}"<br><br>Der DKP-Stand wird automatisch korrigiert.`
})

const editTxTypeLabel = computed(() => {
  if (!editingTx.value) return ''
  const t = editingTx.value.type
  return t === 'earn' ? 'Verdient' : t === 'spend' ? 'Beute' : t === 'adjust' ? 'Anpassung' : 'Verfall'
})

onMounted(() => {
  if (!dkp.balances.length) {
    dkp.load()
  }
})
</script>

<template>
  <div id="v-dkp">
    <DkpActionsBar />

    <DkpAwardForm v-if="ui.dkpView === 'award' && isOfficer" />
    <DkpSpendForm v-else-if="ui.dkpView === 'spend' && isOfficer" />
    <DkpDecayForm v-else-if="ui.dkpView === 'decay' && isAdmin" />
    <DkpSettings v-else-if="ui.dkpView === 'settings' && isAdmin" />
    <DkpStandings
      v-else
      @undo="handleUndo"
      @edit-tx="handleEditTx"
      @delete-tx="handleDeleteTx"
    />
  </div>

  <!-- Undo modal -->
  <ConfirmModal
    :open="showUndoModal"
    title="Letzte Transaktion rückgängig machen"
    :message="undoMessage"
    confirm-label="Rückgängig"
    @confirm="doUndo"
    @cancel="showUndoModal = false"
  />

  <!-- Edit Transaction modal -->
  <ConfirmModal
    :open="showEditTxModal"
    title="Transaktion bearbeiten"
    confirm-label="Speichern"
    @confirm="doEditTx"
    @cancel="showEditTxModal = false"
  >
    <template v-if="editingTx">
      <p style="margin-bottom:8px"><strong>{{ editTxTypeLabel }}</strong> — {{ editingTx.playerName }}</p>
      <div class="dkp-edit-form">
        <div class="fld">
          <label>Betrag</label>
          <input id="dkp-edit-amount" v-model.number="editTxAmount" type="number" min="1" :max="dkp.config.maxDkpAmount">
        </div>
        <div class="fld">
          <label>Grund</label>
          <input id="dkp-edit-reason" v-model="editTxReason" type="text" :maxlength="dkp.config.reasonMaxLength || 200">
        </div>
      </div>
    </template>
  </ConfirmModal>

  <!-- Delete Transaction modal -->
  <ConfirmModal
    :open="showDeleteTxModal"
    title="Transaktion löschen"
    :message="deleteTxMessage"
    confirm-label="Löschen"
    @confirm="doDeleteTx"
    @cancel="showDeleteTxModal = false"
  />
</template>

<style scoped>
#v-dkp {
  max-width: 800px;
}

.dkp-edit-form {
  margin-top: 8px;
}

.dkp-edit-form .fld {
  margin-bottom: 12px;
}

.dkp-edit-form label {
  display: block;
  font-size: 12px;
  color: var(--color-tx3);
  margin-bottom: 4px;
}

.dkp-edit-form input {
  display: block;
  width: 100%;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  color: var(--color-tx);
  font: 14px var(--font-body);
  outline: none;
}

.dkp-edit-form input:focus {
  border-color: rgba(201, 168, 76, 0.4);
}
</style>
