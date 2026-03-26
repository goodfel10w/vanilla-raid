<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useEntriesStore } from '@/stores/entries'
import { useAuthStore } from '@/stores/auth'
import { CLS, ROLES, CLASS_SPECS, ROLE_COLORS, ROLE_ICONS, DAYS, DAY_SHORT } from '@/lib/constants'
import type { RoleName } from '@/lib/constants'
import { cc, collapseRanges, csvVal } from '@/lib/utils'
import { useToast } from '@/composables/useToast'
import RoleSummaryCards from '@/components/roster/RoleSummaryCards.vue'
import EntryCard from '@/components/roster/EntryCard.vue'
import EmptyState from '@/components/shared/EmptyState.vue'
import ConfirmModal from '@/components/shared/ConfirmModal.vue'
import ClassIcon from '@/components/shared/ClassIcon.vue'

const entriesStore = useEntriesStore()
const auth = useAuthStore()
const router = useRouter()
const { toast } = useToast()

const rosterSort = ref<'name' | 'class' | 'role'>('name')
const deleteId = ref<string | null>(null)

// Filter state
const searchQuery = ref('')
const filterRole = ref<RoleName | null>(null)
const filterClass = ref<string | null>(null)
const filterSpec = ref<string | null>(null)

const activeFiltersCount = computed(() => {
  let count = 0
  if (searchQuery.value) count++
  if (filterRole.value) count++
  if (filterClass.value) count++
  if (filterSpec.value) count++
  return count
})

function clearFilters() {
  searchQuery.value = ''
  filterRole.value = null
  filterClass.value = null
  filterSpec.value = null
}

function toggleRole(role: RoleName) {
  filterRole.value = filterRole.value === role ? null : role
}

function toggleClass(cls: string) {
  if (filterClass.value === cls) {
    filterClass.value = null
    filterSpec.value = null
  } else {
    filterClass.value = cls
    filterSpec.value = null
  }
}

function toggleSpec(spec: string) {
  filterSpec.value = filterSpec.value === spec ? null : spec
}

const availableSpecs = computed(() => {
  if (!filterClass.value) return []
  return CLASS_SPECS[filterClass.value] || []
})

// Classes present in entries for showing active filter chips
const classesInEntries = computed(() => {
  const set = new Set<string>()
  entriesStore.entries.forEach(e => set.add(e.className))
  return CLS.filter(c => set.has(c.name))
})

const filteredEntries = computed(() => {
  let arr = [...entriesStore.entries]

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    arr = arr.filter(e => e.charName.toLowerCase().includes(q))
  }

  if (filterRole.value) {
    arr = arr.filter(e => (e.roles || []).includes(filterRole.value!))
  }

  if (filterClass.value) {
    arr = arr.filter(e => e.className === filterClass.value)
  }

  if (filterSpec.value) {
    arr = arr.filter(e => (e.specs || []).includes(filterSpec.value!))
  }

  return arr
})

const sortedEntries = computed(() => {
  const arr = [...filteredEntries.value]
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
    <RoleSummaryCards
      :entries="entriesStore.entries"
      :active-role="filterRole"
      @role-click="toggleRole"
    />

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
      <!-- Filter panel -->
      <div class="filter-panel">
        <div class="filter-header">
          <span class="filter-title">Filter</span>
          <span v-if="activeFiltersCount" class="filter-count">{{ activeFiltersCount }}</span>
          <button v-if="activeFiltersCount" class="filter-clear" @click="clearFilters">Zur&uuml;cksetzen</button>
        </div>

        <!-- Search -->
        <div class="filter-search">
          <input
            v-model="searchQuery"
            type="text"
            class="filter-input"
            placeholder="Charakter suchen…"
          />
        </div>

        <!-- Role filter -->
        <div class="filter-group">
          <div class="filter-label">Rolle</div>
          <div class="filter-chips">
            <button
              v-for="role in ROLES"
              :key="role"
              class="fchip fchip-role"
              :class="{ active: filterRole === role }"
              :style="filterRole === role
                ? { background: ROLE_COLORS[role] + '25', borderColor: ROLE_COLORS[role], color: ROLE_COLORS[role] }
                : {}"
              @click="toggleRole(role)"
            >
              <span class="fchip-icon">{{ ROLE_ICONS[role] }}</span>
              {{ role }}
            </button>
          </div>
        </div>

        <!-- Class filter -->
        <div class="filter-group">
          <div class="filter-label">Klasse</div>
          <div class="filter-chips">
            <button
              v-for="cls in classesInEntries"
              :key="cls.name"
              class="fchip fchip-class"
              :class="{ active: filterClass === cls.name }"
              :style="filterClass === cls.name
                ? { background: cls.color + '18', borderColor: cls.color, color: cls.color }
                : {}"
              @click="toggleClass(cls.name)"
            >
              <ClassIcon :class-name="cls.name" size="sm" />
              {{ cls.name }}
            </button>
          </div>
        </div>

        <!-- Spec filter (shown when class is selected) -->
        <div v-if="availableSpecs.length" class="filter-group">
          <div class="filter-label">Spezialisierung</div>
          <div class="filter-chips">
            <button
              v-for="spec in availableSpecs"
              :key="spec.name"
              class="fchip fchip-spec"
              :class="{ active: filterSpec === spec.name }"
              :style="filterSpec === spec.name
                ? { background: ROLE_COLORS[spec.role] + '25', borderColor: ROLE_COLORS[spec.role], color: ROLE_COLORS[spec.role] }
                : {}"
              @click="toggleSpec(spec.name)"
            >
              <span class="fchip-role-dot" :style="{ background: ROLE_COLORS[spec.role] }"></span>
              {{ spec.name }}
            </button>
          </div>
        </div>
      </div>

      <!-- Toolbar row -->
      <div class="toolbar-row">
        <div class="sort-bar">
          Sortieren:
          <select v-model="rosterSort" class="sort-sel">
            <option value="name">Name</option>
            <option value="class">Klasse</option>
            <option value="role">Rolle</option>
          </select>
        </div>
        <div class="toolbar-right">
          <span class="result-count">{{ sortedEntries.length }}
            <span v-if="activeFiltersCount"> / {{ entriesStore.entries.length }}</span>
            Eintr&auml;ge
          </span>
          <button class="btn-export" @click="exportCSV">CSV Export</button>
        </div>
      </div>

      <div v-if="!sortedEntries.length && activeFiltersCount" class="no-results">
        Keine Eintr&auml;ge f&uuml;r diese Filter.
        <button class="filter-clear" @click="clearFilters">Filter zur&uuml;cksetzen</button>
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
/* Filter panel */
.filter-panel {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
}

.filter-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.filter-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-tx3);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.filter-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--color-gold);
  color: var(--color-bg);
  font-size: 11px;
  font-weight: 700;
}

.filter-clear {
  margin-left: auto;
  font-size: 12px;
  color: var(--color-gold);
  background: none;
  border: none;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.filter-clear:hover {
  color: var(--color-gold-light);
}

.filter-search {
  margin-bottom: 12px;
}

.filter-input {
  width: 100%;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.03);
  color: var(--color-tx);
  font-size: 13px;
  transition: border-color 0.15s;
}

.filter-input::placeholder {
  color: var(--color-tx5);
}

.filter-input:focus {
  border-color: rgba(201, 168, 76, 0.4);
  outline: none;
}

.filter-group {
  margin-bottom: 10px;
}

.filter-group:last-child {
  margin-bottom: 0;
}

.filter-label {
  font-size: 11px;
  color: var(--color-tx4);
  margin-bottom: 6px;
  font-weight: 600;
}

.filter-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.fchip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.02);
  color: var(--color-tx3);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.fchip:hover {
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
}

.fchip.active {
  font-weight: 600;
}

.fchip-icon {
  font-size: 13px;
}

.fchip-role-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* Toolbar row */
.toolbar-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 14px;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.result-count {
  font-size: 12px;
  color: var(--color-tx4);
}

.sort-bar {
  display: flex;
  align-items: center;
  gap: 8px;
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

.no-results {
  text-align: center;
  padding: 32px 16px;
  color: var(--color-tx4);
  font-size: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

@media (max-width: 640px) {
  .filter-chips {
    gap: 4px;
  }

  .fchip {
    padding: 6px 10px;
    font-size: 11px;
    min-height: 32px;
  }

  .toolbar-row {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
