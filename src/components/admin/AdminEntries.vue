<script setup lang="ts">
import { ref } from 'vue'
import { useEntriesStore } from '@/stores/entries'
import { useToast } from '@/composables/useToast'
import { cc } from '@/lib/utils'
import ConfirmModal from '@/components/shared/ConfirmModal.vue'

const entriesStore = useEntriesStore()
const { toast } = useToast()

const deleteTarget = ref<{ id: string; name: string } | null>(null)

function confirmDelete(id: string, name: string) {
  deleteTarget.value = { id, name }
}

async function doDelete() {
  if (!deleteTarget.value) return
  const name = deleteTarget.value.name
  try {
    await entriesStore.remove(deleteTarget.value.id)
    toast(`${name} geloescht`)
  } catch (e: unknown) {
    toast('Fehler: ' + (e instanceof Error ? e.message : 'Unbekannter Fehler'))
  }
  deleteTarget.value = null
}

function formatDate(ts: string): string {
  if (!ts) return '\u2014'
  return new Date(ts).toLocaleDateString('de-DE')
}
</script>

<template>
  <div class="card">
    <div class="card-t">Alle Eintraege ({{ entriesStore.entries.length }})</div>
    <div v-if="!entriesStore.entries.length" class="empty-msg">
      Keine Eintraege vorhanden.
    </div>
    <div v-else class="table-wrap">
      <table class="adm-entries-table">
        <thead>
          <tr>
            <th>Charakter</th>
            <th>Klasse</th>
            <th>Rollen</th>
            <th>Erstellt</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="e in entriesStore.entries" :key="e.id">
            <td><strong>{{ e.charName }}</strong></td>
            <td :style="{ color: cc(e.className) }">{{ e.className }}</td>
            <td class="roles-cell">{{ (e.roles || []).join(', ') }}</td>
            <td class="date-cell">{{ formatDate(e.timestamp) }}</td>
            <td>
              <button class="adm-entry-del" @click="confirmDelete(e.id, e.charName)">Loeschen</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <ConfirmModal
    :open="!!deleteTarget"
    title="Eintrag loeschen"
    :message="deleteTarget ? `Wirklich <strong>${deleteTarget.name}</strong> loeschen?` : ''"
    @confirm="doDelete"
    @cancel="deleteTarget = null"
  />
</template>

<style scoped>
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

.empty-msg {
  color: var(--color-tx4);
  font-size: 13px;
}

.table-wrap {
  overflow-x: auto;
}

.adm-entries-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.adm-entries-table th {
  text-align: left;
  padding: 8px 10px;
  color: var(--color-tx3);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid var(--color-border);
}

.adm-entries-table td {
  padding: 8px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
}

.roles-cell {
  font-size: 12px;
  color: var(--color-tx3);
}

.date-cell {
  color: var(--color-tx4);
  font-size: 12px;
}

.adm-entry-del {
  padding: 4px 10px;
  border-radius: 4px;
  border: 1px solid rgba(229, 115, 115, 0.3);
  background: rgba(229, 115, 115, 0.08);
  color: #e57373;
  cursor: pointer;
  font-size: 11px;
  transition: all 0.15s;
}

.adm-entry-del:hover {
  background: rgba(229, 115, 115, 0.15);
}
</style>
