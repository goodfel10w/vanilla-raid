<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useDkpStore } from '@/stores/dkp'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { cc, linkItems } from '@/lib/utils'
import { CLS } from '@/lib/constants'
import { useToast } from '@/composables/useToast'
import { api } from '@/lib/api'
import ConfirmModal from '@/components/shared/ConfirmModal.vue'
import DkpTransactionRow from './DkpTransactionRow.vue'

const props = defineProps<{
  playerName: string
}>()

const emit = defineEmits<{
  close: []
}>()

const dkp = useDkpStore()
const auth = useAuthStore()
const ui = useUiStore()
const { toast } = useToast()

const playerTx = ref<any[]>([])
const loadingTx = ref(false)

const isAdmin = computed(() => {
  if (!auth.user) return false
  const uname = auth.user.username?.toLowerCase().split('#')[0]
  const roles = dkp.config.roles || {}
  return roles[uname] === 'admin' || auth.isAdmin
})

const bal = computed(() => dkp.balances.find(b => b.playerName === props.playerName))
const playerColor = computed(() => cc(bal.value?.className || ''))
const balCls = computed(() => {
  if (!bal.value) return 'dkp-zero'
  return bal.value.balance > 0 ? 'dkp-pos' : bal.value.balance < 0 ? 'dkp-neg' : 'dkp-zero'
})

const earned = computed(() => playerTx.value.filter(t => t.type === 'earn').reduce((s: number, t: any) => s + t.amount, 0))
const spent = computed(() => playerTx.value.filter(t => t.type === 'spend').reduce((s: number, t: any) => s + Math.abs(t.amount), 0))
const decayed = computed(() => playerTx.value.filter(t => t.type === 'decay').reduce((s: number, t: any) => s + Math.abs(t.amount), 0))
const adjusted = computed(() => playerTx.value.filter(t => t.type === 'adjust').reduce((s: number, t: any) => s + t.amount, 0))

const filteredPlayerTx = computed(() => {
  const f = ui.dkpTxFilter
  if (f === 'all') return playerTx.value
  return playerTx.value.filter((t: any) => t.type === f)
})

async function loadPlayerTx() {
  loadingTx.value = true
  try {
    const data = await api.get<{ transactions: any[] }>(`/api/dkp?player=${encodeURIComponent(props.playerName)}`)
    playerTx.value = data.transactions || []
  } catch {
    playerTx.value = []
  } finally {
    loadingTx.value = false
  }
}

watch(() => props.playerName, () => {
  ui.dkpTxFilter = 'all'
  loadPlayerTx()
}, { immediate: true })

// Modals
const showAdjustModal = ref(false)
const adjBalance = ref(0)
const adjReason = ref('')

const showEditModal = ref(false)
const editName = ref('')
const editClass = ref('')

const showDeleteModal = ref(false)
const deleteTransactions = ref(true)

const showEditTxModal = ref(false)
const editingTx = ref<any>(null)
const editTxAmount = ref(0)
const editTxReason = ref('')

const showDeleteTxModal = ref(false)
const deletingTxId = ref('')

function openAdjust() {
  adjBalance.value = bal.value?.balance || 0
  adjReason.value = ''
  showAdjustModal.value = true
}

async function doAdjust() {
  try {
    await dkp.adjustBalance(props.playerName, adjBalance.value, adjReason.value || 'Manuelle Anpassung')
    toast(`DKP von ${props.playerName} auf ${adjBalance.value} gesetzt`)
    showAdjustModal.value = false
    await loadPlayerTx()
  } catch (e: any) {
    toast('Fehler: ' + e.message)
  }
}

function openEditPlayer() {
  editName.value = props.playerName
  editClass.value = bal.value?.className || ''
  showEditModal.value = true
}

async function doEditPlayer() {
  if (!editName.value.trim()) { toast('Name darf nicht leer sein'); return }
  try {
    await dkp.editPlayer(props.playerName, editClass.value)
    toast('Spieler aktualisiert')
    showEditModal.value = false
    await loadPlayerTx()
  } catch (e: any) {
    toast('Fehler: ' + e.message)
  }
}

function openDeletePlayer() {
  deleteTransactions.value = true
  showDeleteModal.value = true
}

async function doDeletePlayer() {
  try {
    await dkp.deletePlayer(props.playerName)
    toast(`${props.playerName} aus DKP entfernt`)
    showDeleteModal.value = false
    emit('close')
  } catch (e: any) {
    toast('Fehler: ' + e.message)
  }
}

function openEditTx(txId: string) {
  const tx = playerTx.value.find((t: any) => t.id === txId)
  if (!tx) return
  editingTx.value = tx
  editTxAmount.value = Math.abs(tx.amount)
  editTxReason.value = tx.reason
  showEditTxModal.value = true
}

async function doEditTx() {
  if (!editTxAmount.value || editTxAmount.value <= 0) { toast('Ungültiger Betrag'); return }
  try {
    await dkp.editTransaction(editingTx.value.id, editTxAmount.value, editTxReason.value)
    toast('Transaktion aktualisiert')
    showEditTxModal.value = false
    await loadPlayerTx()
  } catch (e: any) {
    toast('Fehler: ' + e.message)
  }
}

function openDeleteTx(txId: string) {
  deletingTxId.value = txId
  showDeleteTxModal.value = true
}

async function doDeleteTx() {
  try {
    await dkp.deleteTransaction(deletingTxId.value)
    toast('Transaktion gelöscht')
    showDeleteTxModal.value = false
    await loadPlayerTx()
  } catch (e: any) {
    toast('Fehler: ' + e.message)
  }
}

const deletingTx = computed(() => {
  const tx = playerTx.value.find((t: any) => t.id === deletingTxId.value) ||
    dkp.transactions.find(t => t.id === deletingTxId.value)
  return tx
})

const deleteTxMessage = computed(() => {
  const tx = deletingTx.value
  if (!tx) return ''
  const typeLabel = tx.type === 'earn' ? 'Verdient' : tx.type === 'spend' ? 'Beute' : tx.type === 'adjust' ? 'Anpassung' : 'Verfall'
  const amtStr = tx.amount > 0 ? '+' + tx.amount : String(tx.amount)
  const reason = tx.type === 'spend' ? linkItems(tx.reason) : tx.reason
  return `<strong>${typeLabel}</strong>: ${tx.playerName} ${amtStr} DKP — „${reason}"<br><br>Der DKP-Stand wird automatisch korrigiert.`
})
</script>

<template>
  <div class="card dkp-player-detail">
    <div v-if="!bal" class="empty">Spieler nicht gefunden</div>
    <template v-else>
      <div class="dkp-detail-header">
        <div>
          <div class="dkp-detail-name" :style="{ color: playerColor }">{{ bal.playerName }}</div>
          <div class="dkp-detail-class">{{ bal.className || '' }}</div>
        </div>
        <div class="dkp-detail-bal" :class="balCls">{{ bal.balance > 0 ? '+' : '' }}{{ bal.balance }} DKP</div>
        <button class="dkp-detail-close" @click="emit('close')">&times;</button>
      </div>

      <div class="dkp-detail-stats">
        <div class="dkp-detail-stat"><strong style="color:var(--color-green)">+{{ earned }}</strong>Verdient</div>
        <div class="dkp-detail-stat"><strong style="color:var(--color-red, #e57373)">&minus;{{ spent }}</strong>Beute</div>
        <div class="dkp-detail-stat"><strong style="color:var(--color-yellow, #ffd54f)">&minus;{{ decayed }}</strong>Verfall</div>
        <div v-if="adjusted" class="dkp-detail-stat"><strong style="color:var(--color-gold)">{{ adjusted > 0 ? '+' : '' }}{{ adjusted }}</strong>Anpassung</div>
        <div class="dkp-detail-stat"><strong>{{ playerTx.length }}</strong>Transaktionen</div>
      </div>

      <!-- Admin actions -->
      <div v-if="isAdmin" class="dkp-detail-actions">
        <button class="dkp-detail-action" @click="openAdjust">DKP anpassen</button>
        <button class="dkp-detail-action" @click="openEditPlayer">Bearbeiten</button>
        <button class="dkp-detail-action danger" @click="openDeletePlayer">Spieler löschen</button>
      </div>

      <!-- Transaction filters and list -->
      <template v-if="playerTx.length">
        <div class="card-t" style="margin-bottom:8px">Alle Transaktionen</div>
        <div class="dkp-tx-filters">
          <button class="dkp-tx-filter" :class="{ active: ui.dkpTxFilter === 'all' }" @click="ui.dkpTxFilter = 'all'">Alle</button>
          <button class="dkp-tx-filter" :class="{ active: ui.dkpTxFilter === 'earn' }" @click="ui.dkpTxFilter = 'earn'">Verdient</button>
          <button class="dkp-tx-filter" :class="{ active: ui.dkpTxFilter === 'spend' }" @click="ui.dkpTxFilter = 'spend'">Beute</button>
          <button class="dkp-tx-filter" :class="{ active: ui.dkpTxFilter === 'decay' }" @click="ui.dkpTxFilter = 'decay'">Verfall</button>
          <button class="dkp-tx-filter" :class="{ active: ui.dkpTxFilter === 'adjust' }" @click="ui.dkpTxFilter = 'adjust'">Anpassung</button>
        </div>
        <template v-if="filteredPlayerTx.length">
          <DkpTransactionRow
            v-for="tx in filteredPlayerTx"
            :key="tx.id"
            :tx="tx"
            :show-actions="isAdmin"
            @edit="openEditTx"
            @delete="openDeleteTx"
          />
        </template>
        <div v-else class="empty" style="padding:12px 0">Keine Transaktionen in dieser Kategorie.</div>
      </template>
      <div v-else class="empty">Keine Transaktionen</div>
    </template>
  </div>

  <!-- Adjust Balance Modal -->
  <ConfirmModal
    :open="showAdjustModal"
    title="DKP anpassen"
    confirm-label="Anpassen"
    @confirm="doAdjust"
    @cancel="showAdjustModal = false"
  >
    <div class="dkp-edit-form">
      <div class="fld">
        <label>Neuer DKP-Stand</label>
        <input id="dkp-adj-balance" v-model.number="adjBalance" type="number">
      </div>
      <div class="fld">
        <label>Grund (optional)</label>
        <input id="dkp-adj-reason" v-model="adjReason" type="text" placeholder="z.B. Korrektur, Bonus" :maxlength="dkp.config.reasonMaxLength || 200">
      </div>
    </div>
  </ConfirmModal>

  <!-- Edit Player Modal -->
  <ConfirmModal
    :open="showEditModal"
    title="Spieler bearbeiten"
    confirm-label="Speichern"
    @confirm="doEditPlayer"
    @cancel="showEditModal = false"
  >
    <div class="dkp-edit-form">
      <div class="fld">
        <label>Klasse</label>
        <select id="dkp-edit-class" v-model="editClass">
          <option value="">— Keine —</option>
          <option v-for="c in CLS" :key="c.name" :value="c.name">{{ c.name }}</option>
        </select>
      </div>
    </div>
  </ConfirmModal>

  <!-- Delete Player Modal -->
  <ConfirmModal
    :open="showDeleteModal"
    title="Spieler aus DKP löschen"
    confirm-label="Löschen"
    @confirm="doDeletePlayer"
    @cancel="showDeleteModal = false"
  >
    <p style="margin-bottom:12px"><strong>{{ playerName }}</strong> komplett aus dem DKP-System entfernen?</p>
    <label style="font-size:13px;color:var(--color-tx3);cursor:pointer">
      <input v-model="deleteTransactions" type="checkbox" style="margin-right:6px;vertical-align:middle">
      Alle Transaktionen ebenfalls löschen
    </label>
  </ConfirmModal>

  <!-- Edit Transaction Modal -->
  <ConfirmModal
    :open="showEditTxModal"
    title="Transaktion bearbeiten"
    confirm-label="Speichern"
    @confirm="doEditTx"
    @cancel="showEditTxModal = false"
  >
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
  </ConfirmModal>

  <!-- Delete Transaction Modal -->
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
.dkp-player-detail {
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 20px;
}

.dkp-detail-header {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 16px;
}

.dkp-detail-name {
  font: 700 20px var(--font-heading);
}

.dkp-detail-class {
  font-size: 12px;
  color: var(--color-tx3);
  margin-top: 2px;
}

.dkp-detail-bal {
  margin-left: auto;
  font: 700 24px var(--font-heading);
}

.dkp-pos { color: var(--color-green); }
.dkp-neg { color: var(--color-red, #e57373); }
.dkp-zero { color: var(--color-tx3); }

.dkp-detail-close {
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background: none;
  color: var(--color-tx3);
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  transition: all 0.15s;
}

.dkp-detail-close:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--color-tx);
}

.dkp-detail-stats {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.dkp-detail-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: 12px;
  color: var(--color-tx3);
  gap: 2px;
}

.dkp-detail-stat strong {
  font-size: 18px;
}

.dkp-detail-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.dkp-detail-action {
  padding: 6px 14px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background: none;
  color: var(--color-tx2);
  cursor: pointer;
  font: 12px var(--font-body);
  transition: all 0.15s;
}

.dkp-detail-action:hover {
  background: rgba(255, 255, 255, 0.05);
}

.dkp-detail-action.danger {
  border-color: rgba(229, 115, 115, 0.3);
  color: var(--color-red, #e57373);
}

.dkp-detail-action.danger:hover {
  background: rgba(229, 115, 115, 0.1);
}

.card-t {
  font: 600 15px var(--font-heading);
  color: var(--color-gold);
}

.dkp-tx-filters {
  display: flex;
  gap: 4px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.dkp-tx-filter {
  padding: 4px 10px;
  border-radius: 4px;
  border: 1px solid var(--color-border);
  background: none;
  color: var(--color-tx3);
  cursor: pointer;
  font-size: 11px;
  transition: all 0.15s;
}

.dkp-tx-filter:hover {
  background: rgba(255, 255, 255, 0.05);
}

.dkp-tx-filter.active {
  background: rgba(201, 168, 76, 0.12);
  border-color: rgba(201, 168, 76, 0.3);
  color: var(--color-gold);
}

.empty {
  text-align: center;
  padding: 20px;
  color: var(--color-tx3);
  font-size: 13px;
}

.dkp-edit-form {
  margin-top: 12px;
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

.dkp-edit-form input,
.dkp-edit-form select {
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

.dkp-edit-form input:focus,
.dkp-edit-form select:focus {
  border-color: rgba(201, 168, 76, 0.4);
}
</style>
