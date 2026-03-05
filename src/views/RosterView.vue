<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useEntriesStore } from '@/stores/entries'
import { useAuthStore } from '@/stores/auth'
import { CLS, ROLES, DAYS, DAY_SHORT } from '@/lib/constants'
import { collapseRanges, csvVal } from '@/lib/utils'
import { useToast } from '@/composables/useToast'
import RoleSummaryCards from '@/components/roster/RoleSummaryCards.vue'
import EntryCard from '@/components/roster/EntryCard.vue'
import EmptyState from '@/components/shared/EmptyState.vue'
import ConfirmModal from '@/components/shared/ConfirmModal.vue'

const entriesStore = useEntriesStore()
const auth = useAuthStore()
const router = useRouter()
const { toast } = useToast()

const rosterSort = ref<'name' | 'class' | 'role'>('name')
const deleteId = ref<string | null>(null)

const sortedEntries = computed(() => {
  const arr = [...entriesStore.entries]
  if (rosterSort.value === 'class') {
    return arr.sort((a, b) => {
      const ci = CLS.findIndex(c => c.name === a.className) - CLS.findIndex(c => c.name === b.className)
      return ci || a.charName.localeCompare(b.charName)
    })
  }
  if (rosterSort.value === 'role') {
    return arr.sort((a, b) => {
      const ra = (a.roles || [])[0] || ''
      const rb = (b.roles || [])[0] || ''
      const ri = ROLES.indexOf(ra as any) - ROLES.indexOf(rb as any)
      return ri || a.charName.localeCompare(b.charName)
    })
  }
  return arr.sort((a, b) => a.charName.localeCompare(b.charName))
})

const showClaimHint = computed(() => {
  if (!auth.user || !entriesStore.entries.length) return false
  const hasOwn = entriesStore.entries.some(e => e.userId === auth.user!.userId)
  if (hasOwn) return false
  return entriesStore.entries.some(e => !e.userId)
})

function canEdit(entry: { userId?: string }) {
  if (!auth.user) return false
  if (auth.isAdmin) return true
  if (!entry.userId) return true
  return entry.userId === auth.user.userId
}

function handleEdit(id: string) {
  router.push({ path: '/form', query: { edit: id } })
}

function handleDeleteRequest(id: string) {
  deleteId.value = id
}

async function confirmDelete() {
  if (!deleteId.value) return
  try {
    await entriesStore.remove(deleteId.value)
    toast('Eintrag gel\u00f6scht \u2713')
  } catch {
    toast('Fehler beim L\u00f6schen')
  }
  deleteId.value = null
}

function exportCSV() {
  const header = ['Charakter', 'Klasse', 'Rollen', ...DAYS.map(d => DAY_SHORT[d]), 'Anmerkungen']
  const rows = [header.map(csvVal).join(',')]
  entriesStore.entries.forEach(e => {
    const roles = (e.roles || []).join(', ')
    const cols = [e.charName, e.className, roles]
    DAYS.forEach(d => {
      const ranges = collapseRanges(e.availability || {}, d)
      if (!ranges.length) { cols.push('\u2014'); return }
      const parts = ranges.map(r => {
        const prefix = r.type === 'tentative' ? '? ' : ''
        return prefix + r.start + '\u2013' + r.end
      })
      cols.push(parts.join(', '))
    })
    cols.push(e.notes || '')
    rows.push(cols.map(csvVal).join(','))
  })
  const bom = '\uFEFF'
  const blob = new Blob([bom + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'raid-verfuegbarkeit.csv'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  toast('CSV exportiert \u2713')
}

const deleteEntry = computed(() => {
  if (!deleteId.value) return null
  return entriesStore.entries.find(e => e.id === deleteId.value) || null
})
</script>

<template>
  <div id="v-roster">
    <RoleSummaryCards :entries="entriesStore.entries" />

    <div v-if="entriesStore.entries.length" style="margin-bottom:16px">
      <button class="btn-export" @click="exportCSV">CSV Export</button>
    </div>

    <div
      v-if="showClaimHint"
      class="card"
      style="border:1px solid rgba(201,168,76,.3);padding:12px 16px;margin-bottom:16px;font-size:13px;color:var(--color-tx3)"
    >
      Du hast noch keinen Charakter mit deinem Account verkn&uuml;pft.
      Klicke bei deinem Eintrag auf <strong style="color:var(--color-tx)">Bearbeiten</strong>
      und speichere ihn &mdash; dann geh&ouml;rt er dir.
    </div>

    <EmptyState v-if="!entriesStore.entries.length" message="Noch keine Eintr&auml;ge. Sei der Erste!" />

    <template v-if="entriesStore.entries.length">
      <div class="sort-bar">
        Sortieren:
        <select v-model="rosterSort" class="sort-sel">
          <option value="name">Name</option>
          <option value="class">Klasse</option>
          <option value="role">Rolle</option>
        </select>
      </div>

      <EntryCard
        v-for="e in sortedEntries"
        :key="e.id"
        :entry="e"
        :can-edit="canEdit(e)"
        @edit="handleEdit"
        @delete="handleDeleteRequest"
      />
    </template>

    <ConfirmModal
      :open="!!deleteId"
      title="Eintrag l&ouml;schen?"
      :message="deleteEntry ? `<strong>${deleteEntry.charName}</strong> wirklich l&ouml;schen?` : ''"
      confirm-label="L&ouml;schen"
      cancel-label="Abbrechen"
      @confirm="confirmDelete"
      @cancel="deleteId = null"
    />
  </div>
</template>

<style scoped>
.sort-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  font-size: 13px;
  color: var(--color-tx3);
}

.sort-sel {
  padding: 5px 10px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-tx);
  font-size: 13px;
  cursor: pointer;
}

.btn-export {
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid rgba(201, 168, 76, 0.3);
  background: rgba(201, 168, 76, 0.08);
  color: var(--color-gold);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-export:hover {
  background: rgba(201, 168, 76, 0.15);
}
</style>
