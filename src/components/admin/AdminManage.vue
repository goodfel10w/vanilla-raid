<script setup lang="ts">
import { ref, computed } from 'vue'
import { useEntriesStore } from '@/stores/entries'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { api } from '@/lib/api'
import ConfirmModal from '@/components/shared/ConfirmModal.vue'

const entriesStore = useEntriesStore()
const authStore = useAuthStore()
const { toast } = useToast()

const showPurgeUsersModal = ref(false)
const showPurgeEntriesModal = ref(false)
const purging = ref(false)

const entryCount = computed(() => entriesStore.entries.length)

async function doPurgeUsers() {
  purging.value = true
  try {
    await api.post('/api/admin', { action: 'purge-users' })
    toast('Accounts zurueckgesetzt')
  } catch (e: unknown) {
    toast('Fehler: ' + (e instanceof Error ? e.message : 'Unbekannter Fehler'))
  }
  purging.value = false
  showPurgeUsersModal.value = false
}

async function doPurgeEntries() {
  purging.value = true
  try {
    // Delete all entries one by one
    for (const e of entriesStore.entries) {
      await entriesStore.remove(e.id)
    }
    toast('Alle Raider entfernt')
  } catch (e: unknown) {
    toast('Fehler: ' + (e instanceof Error ? e.message : 'Unbekannter Fehler'))
  }
  purging.value = false
  showPurgeEntriesModal.value = false
}
</script>

<template>
  <div class="card">
    <div class="card-t">Verwaltung</div>
    <p class="manage-desc">
      Administrative Aktionen. Diese Aktionen koennen nicht rueckgaengig gemacht werden.
    </p>
    <div class="adm-danger">
      <div class="adm-danger-t">Gefahrenzone</div>
      <div class="adm-danger-row">
        <div class="adm-danger-info">
          <strong>Accounts zuruecksetzen</strong>
          <small>Alle Accounts ausser Admins werden geloescht. Nutzer muessen sich neu anmelden. Raid-Eintraege bleiben erhalten.</small>
        </div>
        <button class="adm-danger-btn" @click="showPurgeUsersModal = true">Zuruecksetzen</button>
      </div>
      <div class="adm-danger-row">
        <div class="adm-danger-info">
          <strong>Alle Raider entfernen</strong>
          <small>Alle {{ entryCount }} Eintraege werden unwiderruflich geloescht.</small>
        </div>
        <button class="adm-danger-btn" @click="showPurgeEntriesModal = true">Alle entfernen</button>
      </div>
    </div>
  </div>

  <ConfirmModal
    :open="showPurgeUsersModal"
    title="Accounts zuruecksetzen"
    message="Alle Accounts ausser Admins werden geloescht. Nutzer muessen sich neu anmelden."
    confirm-label="Zuruecksetzen"
    @confirm="doPurgeUsers"
    @cancel="showPurgeUsersModal = false"
  />

  <ConfirmModal
    :open="showPurgeEntriesModal"
    title="Alle Raider entfernen"
    :message="`Alle ${entryCount} Eintraege werden unwiderruflich geloescht.`"
    confirm-label="Alle entfernen"
    @confirm="doPurgeEntries"
    @cancel="showPurgeEntriesModal = false"
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

.manage-desc {
  font-size: 13px;
  color: var(--color-tx3);
  margin-bottom: 16px;
}

.adm-danger {
  border: 1px solid rgba(229, 115, 115, 0.2);
  border-radius: 8px;
  padding: 16px;
}

.adm-danger-t {
  font-size: 12px;
  color: #e57373;
  text-transform: uppercase;
  letter-spacing: 1px;
  font-weight: 700;
  margin-bottom: 12px;
}

.adm-danger-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 12px 0;
  border-top: 1px solid rgba(229, 115, 115, 0.1);
}

.adm-danger-row:first-of-type {
  border-top: none;
}

.adm-danger-info {
  flex: 1;
}

.adm-danger-info strong {
  display: block;
  font-size: 13px;
  color: var(--color-tx1);
  margin-bottom: 4px;
}

.adm-danger-info small {
  display: block;
  font-size: 12px;
  color: var(--color-tx4);
  line-height: 1.4;
}

.adm-danger-btn {
  padding: 8px 16px;
  border-radius: 6px;
  border: 1px solid rgba(229, 115, 115, 0.4);
  background: rgba(229, 115, 115, 0.1);
  color: #e57373;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  transition: all 0.15s;
}

.adm-danger-btn:hover {
  background: rgba(229, 115, 115, 0.2);
}
</style>
