<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUiStore } from '@/stores/ui'
import { useDkpStore } from '@/stores/dkp'
import { cc, csvVal } from '@/lib/utils'
import { useDkpRole } from '@/composables/useDkpRole'
import DkpTransactionRow from './DkpTransactionRow.vue'

const router = useRouter()
const ui = useUiStore()
const dkp = useDkpStore()
const { isDkpAdmin: isAdmin } = useDkpRole()

const sorted = computed(() => {
  const list = [...dkp.balances]
  const col = ui.dkpSortCol
  const dir = ui.dkpSortDir
  list.sort((a, b) => {
    let cmp = 0
    if (col === 'name') cmp = a.playerName.localeCompare(b.playerName)
    else if (col === 'class') cmp = (a.className || '').localeCompare(b.className || '')
    else cmp = a.balance - b.balance
    return dir === 'asc' ? cmp : -cmp
  })
  return list
})

const filtered = computed(() => {
  const q = ui.dkpSearchQuery.toLowerCase()
  if (!q) return sorted.value
  return sorted.value.filter(b =>
    b.playerName.toLowerCase().includes(q) ||
    (b.className || '').toLowerCase().includes(q)
  )
})

const filteredTx = computed(() => {
  const f = ui.dkpTxFilter
  if (f === 'all') return dkp.transactions
  return dkp.transactions.filter(t => t.type === f)
})

function sortBy(col: string) {
  if (ui.dkpSortCol === col) {
    ui.dkpSortDir = ui.dkpSortDir === 'asc' ? 'desc' : 'asc'
  } else {
    ui.dkpSortCol = col
    ui.dkpSortDir = col === 'balance' ? 'desc' : 'asc'
  }
}

function sortArrow(col: string) {
  return ui.dkpSortCol === col ? (ui.dkpSortDir === 'asc' ? '\u25B2' : '\u25BC') : ''
}

function showPlayer(name: string) {
  router.push(`/dkp/player/${encodeURIComponent(name)}`)
}

function exportCsv() {
  let csv = 'Rang,Spieler,Klasse,DKP,Zuletzt aktualisiert\n'
  sorted.value.forEach((b, i) => {
    const date = b.lastUpdated ? new Date(b.lastUpdated).toLocaleDateString('de-DE') : ''
    csv += [i + 1, csvVal(b.playerName), csvVal(b.className || ''), b.balance, date].join(',') + '\n'
  })
  csv += '\n\nTransaktionen\nDatum,Spieler,Typ,Betrag,Grund,Von\n'
  dkp.transactions.forEach(tx => {
    const date = new Date(tx.timestamp).toLocaleString('de-DE')
    const type = tx.type === 'earn' ? 'Verdient' : tx.type === 'spend' ? 'Beute' : 'Verfall'
    csv += [csvVal(date), csvVal(tx.playerName), type, tx.amount, csvVal(tx.reason), csvVal(tx.createdBy || '')].join(',') + '\n'
  })
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'dkp-export-' + new Date().toISOString().slice(0, 10) + '.csv'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const emit = defineEmits<{
  undo: []
  editTx: [id: string]
  deleteTx: [id: string]
}>()
</script>

<template>
  <div>
    <!-- Toolbar -->
    <div class="dkp-toolbar">
      <button class="dkp-toolbar-btn" @click="exportCsv">CSV Export</button>
      <button
        v-if="isAdmin && dkp.transactions.length"
        class="dkp-toolbar-btn dkp-undo"
        @click="emit('undo')"
      >Rückgängig</button>
    </div>

    <!-- Search -->
    <div class="dkp-search">
      <label for="dkp-search-input" class="sr-only">Spieler suchen</label>
      <input
        id="dkp-search-input"
        type="text"
        :value="ui.dkpSearchQuery"
        placeholder="Spieler suchen…"
        @input="ui.dkpSearchQuery = ($event.target as HTMLInputElement).value"
      >
    </div>

    <!-- Standings table -->
    <div class="card">
      <div class="card-t">
        DKP-Übersicht<span
          v-if="filtered.length !== sorted.length"
          style="font-size:12px;color:var(--color-tx4);font-weight:400"
        > ({{ filtered.length }} von {{ sorted.length }})</span>
      </div>

      <div v-if="!sorted.length" class="empty">
        Noch keine DKP-Einträge. Vergib DKP über den "Vergeben"-Tab.
      </div>
      <div v-else-if="!filtered.length" class="empty">
        Keine Treffer für „{{ ui.dkpSearchQuery }}"
      </div>
      <div v-else style="overflow-x:auto">
        <table class="dkp-standings">
          <thead>
            <tr>
              <th>#</th>
              <th
                :class="{ 'dkp-sort-active': ui.dkpSortCol === 'name' }"
                data-dkp-sort="name"
                @click="sortBy('name')"
              >Spieler<span class="dkp-sort-arrow">{{ sortArrow('name') }}</span></th>
              <th
                :class="{ 'dkp-sort-active': ui.dkpSortCol === 'class' }"
                data-dkp-sort="class"
                @click="sortBy('class')"
              >Klasse<span class="dkp-sort-arrow">{{ sortArrow('class') }}</span></th>
              <th
                :class="{ 'dkp-sort-active': ui.dkpSortCol === 'balance' }"
                data-dkp-sort="balance"
                style="text-align:right"
                @click="sortBy('balance')"
              >DKP<span class="dkp-sort-arrow">{{ sortArrow('balance') }}</span></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(b, i) in filtered"
              :key="b.playerName"
              data-dkp-player
              @click="showPlayer(b.playerName)"
            >
              <td class="dkp-rank">{{ i + 1 }}</td>
              <td style="font-weight:600" :style="{ color: cc(b.className) }">{{ b.playerName }}</td>
              <td style="font-size:12px;color:var(--color-tx3)">{{ b.className || '\u2014' }}</td>
              <td style="text-align:right">
                <span
                  class="dkp-bal"
                  :class="b.balance > 0 ? 'dkp-pos' : b.balance < 0 ? 'dkp-neg' : 'dkp-zero'"
                >{{ b.balance > 0 ? '+' : '' }}{{ b.balance }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Recent transactions -->
    <div v-if="dkp.transactions.length" class="card" style="margin-top:16px">
      <div class="card-t">Letzte Transaktionen</div>
      <div class="dkp-tx-filters">
        <button
          class="dkp-tx-filter"
          :class="{ active: ui.dkpTxFilter === 'all' }"
          @click="ui.dkpTxFilter = 'all'"
        >Alle</button>
        <button
          class="dkp-tx-filter"
          :class="{ active: ui.dkpTxFilter === 'earn' }"
          @click="ui.dkpTxFilter = 'earn'"
        >Verdient</button>
        <button
          class="dkp-tx-filter"
          :class="{ active: ui.dkpTxFilter === 'spend' }"
          @click="ui.dkpTxFilter = 'spend'"
        >Beute</button>
        <button
          class="dkp-tx-filter"
          :class="{ active: ui.dkpTxFilter === 'decay' }"
          @click="ui.dkpTxFilter = 'decay'"
        >Verfall</button>
        <button
          class="dkp-tx-filter"
          :class="{ active: ui.dkpTxFilter === 'adjust' }"
          @click="ui.dkpTxFilter = 'adjust'"
        >Anpassung</button>
      </div>
      <template v-if="filteredTx.length">
        <DkpTransactionRow
          v-for="tx in filteredTx.slice(0, 20)"
          :key="tx.id"
          :tx="tx"
          :show-actions="isAdmin"
          @edit="emit('editTx', $event)"
          @delete="emit('deleteTx', $event)"
        />
      </template>
      <div v-else class="empty" style="padding:12px 0">Keine Transaktionen in dieser Kategorie.</div>
    </div>
  </div>
</template>

<style scoped>
.dkp-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.dkp-toolbar-btn {
  padding: 6px 14px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background: none;
  color: var(--color-tx2);
  cursor: pointer;
  font: 12px var(--font-body);
  transition: all 0.15s;
}

.dkp-toolbar-btn:hover {
  background: rgba(255, 255, 255, 0.05);
}

.dkp-undo {
  border-color: rgba(229, 115, 115, 0.3);
  color: var(--color-red, #e57373);
}

.dkp-search {
  margin-bottom: 12px;
}

.dkp-search input {
  display: block;
  width: 100%;
  padding: 10px 14px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  color: var(--color-tx);
  font: 14px var(--font-body);
  outline: none;
}

.dkp-search input:focus {
  border-color: rgba(201, 168, 76, 0.4);
}

.card {
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 20px;
}

.card-t {
  font: 600 15px var(--font-heading);
  color: var(--color-gold);
  margin-bottom: 16px;
}

.dkp-standings {
  width: 100%;
  border-collapse: collapse;
}

.dkp-standings th {
  text-align: left;
  padding: 8px 10px;
  font-size: 12px;
  color: var(--color-tx3);
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}

.dkp-standings th.dkp-sort-active {
  color: var(--color-gold);
}

.dkp-sort-arrow {
  margin-left: 4px;
  font-size: 10px;
}

.dkp-standings td {
  padding: 10px;
}

.dkp-standings tbody tr {
  cursor: pointer;
  transition: background 0.1s;
}

.dkp-standings tbody tr:hover {
  background: rgba(201, 168, 76, 0.05);
}

.dkp-rank {
  color: var(--color-tx4);
  font-size: 12px;
  width: 30px;
}

.dkp-bal {
  font-weight: 700;
}

.dkp-pos { color: var(--color-green); }
.dkp-neg { color: var(--color-red, #e57373); }
.dkp-zero { color: var(--color-tx3); }

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
  padding: 24px;
  color: var(--color-tx3);
  font-size: 13px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
</style>
