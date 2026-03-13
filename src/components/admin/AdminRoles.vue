<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useEntriesStore } from '@/stores/entries'
import { useDkpStore } from '@/stores/dkp'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { api } from '@/lib/api'
import ConfirmModal from '@/components/shared/ConfirmModal.vue'

interface AdminUser {
  id: string
  username: string
  battleTag: string
  bnetId: string | null
  createdAt: string | null
  role: 'admin' | 'officer' | null
  isSiteAdmin: boolean
}

const entriesStore = useEntriesStore()
const dkp = useDkpStore()
const auth = useAuthStore()
const { toast } = useToast()

const users = ref<AdminUser[]>([])
const loadingUsers = ref(false)

// Role management
const selectedUser = ref('')
const selectedRole = ref<'officer' | 'admin'>('officer')
const showRemoveModal = ref(false)
const removeUsername = ref('')

onMounted(async () => {
  await loadUsers()
  if (!entriesStore.entries.length) {
    await entriesStore.load()
  }
})

async function loadUsers() {
  loadingUsers.value = true
  try {
    const data = await api.get<{ users: AdminUser[] }>('/api/admin')
    users.value = data.users || []
  } catch (e) {
    console.error('Failed to load users:', e)
  } finally {
    loadingUsers.value = false
  }
}

// Cross-reference: map userId -> character names from entries
const userCharacters = computed(() => {
  const map: Record<string, string[]> = {}
  for (const entry of entriesStore.entries) {
    if (entry.userId) {
      if (!map[entry.userId]) map[entry.userId] = []
      map[entry.userId].push(entry.charName)
    }
  }
  return map
})

// Get roles from DKP config (which is the single source of truth)
const roleEntries = computed(() => {
  const roles = dkp.config.roles || {}
  return Object.entries(roles)
    .sort((a, b) => {
      if (a[1] === 'admin' && b[1] !== 'admin') return -1
      if (b[1] === 'admin' && a[1] !== 'admin') return 1
      return a[0].localeCompare(b[0])
    })
})

// Enrich role entries with user info (characters, battleTag, siteAdmin)
function getUserInfo(roleName: string) {
  // Find matching user from admin API
  const user = users.value.find(u => {
    const lower = u.username.toLowerCase()
    const prefix = lower.split('#')[0]
    return lower === roleName || prefix === roleName
  })
  if (!user) return { characters: [], battleTag: null, isSiteAdmin: false }
  const characters = userCharacters.value[user.id] || []
  return { characters, battleTag: user.battleTag, isSiteAdmin: user.isSiteAdmin }
}

// Users that can be added (not already having a role)
const availableUsers = computed(() => {
  const roles = dkp.config.roles || {}
  const roleKeys = new Set(Object.keys(roles))
  return users.value.filter(u => {
    const lower = u.username.toLowerCase()
    const prefix = lower.split('#')[0]
    return !roleKeys.has(lower) && !roleKeys.has(prefix)
  })
})

function isMe(username: string) {
  return auth.user && username === auth.user.username?.toLowerCase()
}

async function addRole() {
  const username = selectedUser.value
  if (!username) { toast('Benutzer auswaehlen'); return }
  try {
    await dkp.manageRoles('add', username, selectedRole.value)
    toast(`${username} als ${selectedRole.value === 'admin' ? 'Admin' : 'Offizier'} hinzugefuegt`)
    selectedUser.value = ''
    await loadUsers()
  } catch (e: unknown) {
    toast('Fehler: ' + (e instanceof Error ? e.message : 'Unbekannter Fehler'))
  }
}

async function changeRole(username: string, currentRole: string) {
  const newRole = currentRole === 'admin' ? 'officer' : 'admin'
  try {
    await dkp.manageRoles('add', username, newRole as 'admin' | 'officer')
    toast(`${username} ist jetzt ${newRole === 'admin' ? 'Admin' : 'Offizier'}`)
    await loadUsers()
  } catch (e: unknown) {
    toast('Fehler: ' + (e instanceof Error ? e.message : 'Unbekannter Fehler'))
  }
}

function confirmRemoveRole(username: string) {
  removeUsername.value = username
  showRemoveModal.value = true
}

async function doRemoveRole() {
  try {
    await dkp.manageRoles('remove', removeUsername.value, 'officer')
    toast(`${removeUsername.value} entfernt`)
    showRemoveModal.value = false
    await loadUsers()
  } catch (e: unknown) {
    toast('Fehler: ' + (e instanceof Error ? e.message : 'Unbekannter Fehler'))
  }
}
</script>

<template>
  <div class="card">
    <div class="card-t">Rollen-Verwaltung</div>
    <p class="roles-desc">
      Verwalte Admin- und Offizier-Rechte fuer die gesamte Anwendung.
      <strong>Admin</strong> = Volle Kontrolle (Einstellungen, Verfall, Rollen, Verwaltung).
      <strong>Offizier</strong> = DKP vergeben und Beute verbuchen.
    </p>

    <!-- Current roles -->
    <div class="roles-list">
      <div v-for="[uname, role] in roleEntries" :key="uname" class="role-row">
        <div class="role-info">
          <div class="role-name-row">
            <span class="role-account">{{ uname }}{{ isMe(uname) ? ' (Du)' : '' }}</span>
            <span class="role-badge" :class="role === 'admin' ? 'role-badge-admin' : 'role-badge-officer'">
              {{ role === 'admin' ? 'Admin' : 'Offizier' }}
            </span>
            <span v-if="getUserInfo(uname).isSiteAdmin" class="role-badge role-badge-site">Site-Admin</span>
          </div>
          <div v-if="getUserInfo(uname).characters.length" class="role-chars">
            <span v-for="char in getUserInfo(uname).characters" :key="char" class="role-char-chip">{{ char }}</span>
          </div>
          <div v-if="getUserInfo(uname).battleTag && getUserInfo(uname).battleTag !== uname" class="role-btag">
            {{ getUserInfo(uname).battleTag }}
          </div>
        </div>
        <div v-if="!isMe(uname)" class="role-actions">
          <button class="role-btn" @click="changeRole(uname, role)">
            {{ role === 'admin' ? '→ Offizier' : '→ Admin' }}
          </button>
          <button class="role-btn role-btn-del" @click="confirmRemoveRole(uname)">Entfernen</button>
        </div>
      </div>
      <div v-if="!roleEntries.length" class="roles-empty">Keine Rollen zugewiesen.</div>
    </div>

    <!-- Add role -->
    <div class="card-t" style="margin-top:24px">Rolle hinzufuegen</div>
    <div class="role-add">
      <select id="adm-role-user" v-model="selectedUser" class="role-add-select">
        <option value="" disabled>Benutzer auswaehlen...</option>
        <option v-for="u in availableUsers" :key="u.id" :value="u.username.split('#')[0].toLowerCase()">
          {{ u.username }}{{ userCharacters[u.id]?.length ? ' — ' + userCharacters[u.id].join(', ') : '' }}
        </option>
      </select>
      <select id="adm-role-type" v-model="selectedRole" class="role-add-role">
        <option value="officer">Offizier</option>
        <option value="admin">Admin</option>
      </select>
      <button class="btn-p" @click="addRole">Hinzufuegen</button>
    </div>
    <p v-if="!availableUsers.length && !loadingUsers" class="roles-hint">
      Alle registrierten Benutzer haben bereits eine Rolle.
    </p>
    <p v-if="loadingUsers" class="roles-hint">Lade Benutzer...</p>

    <!-- All registered users overview -->
    <div class="card-t" style="margin-top:28px">Registrierte Benutzer</div>
    <p class="roles-desc">
      Alle Benutzer mit Account und zugehoerigen Charakteren.
    </p>
    <div class="users-table">
      <div class="users-header">
        <span class="users-col-account">Account</span>
        <span class="users-col-chars">Charaktere</span>
        <span class="users-col-role">Rolle</span>
      </div>
      <div v-for="u in users" :key="u.id" class="users-row">
        <span class="users-col-account">
          {{ u.username }}
        </span>
        <span class="users-col-chars">
          <template v-if="userCharacters[u.id]?.length">
            <span v-for="char in userCharacters[u.id]" :key="char" class="role-char-chip">{{ char }}</span>
          </template>
          <span v-else class="users-no-chars">—</span>
        </span>
        <span class="users-col-role">
          <span v-if="u.isSiteAdmin" class="role-badge role-badge-site">Site-Admin</span>
          <span v-if="u.role === 'admin'" class="role-badge role-badge-admin">Admin</span>
          <span v-else-if="u.role === 'officer'" class="role-badge role-badge-officer">Offizier</span>
          <span v-else class="users-no-role">—</span>
        </span>
      </div>
      <div v-if="!users.length && !loadingUsers" class="roles-empty">Keine Benutzer gefunden.</div>
    </div>
  </div>

  <ConfirmModal
    :open="showRemoveModal"
    title="Rolle entfernen"
    :message="`Wirklich <strong>${removeUsername}</strong> als Verwalter entfernen?`"
    confirm-label="Entfernen"
    @confirm="doRemoveRole"
    @cancel="showRemoveModal = false"
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
  margin-bottom: 12px;
}

.roles-desc {
  font-size: 13px;
  color: var(--color-tx3);
  margin-bottom: 16px;
  line-height: 1.5;
}

.roles-list {
  margin-bottom: 8px;
}

.role-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.role-info {
  flex: 1;
  min-width: 0;
}

.role-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.role-account {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-tx1);
}

.role-badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.role-badge-admin {
  background: rgba(201, 168, 76, 0.15);
  color: var(--color-gold);
}

.role-badge-officer {
  background: rgba(102, 187, 106, 0.15);
  color: var(--color-green);
}

.role-badge-site {
  background: rgba(144, 202, 249, 0.15);
  color: #90caf9;
}

.role-chars {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 4px;
}

.role-char-chip {
  padding: 1px 8px;
  border-radius: 4px;
  font-size: 12px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--color-tx2);
}

.role-btag {
  font-size: 11px;
  color: var(--color-tx4);
  margin-top: 2px;
}

.role-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.role-btn {
  padding: 4px 10px;
  border-radius: 4px;
  border: 1px solid var(--color-border);
  background: none;
  color: var(--color-tx3);
  cursor: pointer;
  font-size: 11px;
  transition: all 0.15s;
  white-space: nowrap;
}

.role-btn:hover {
  background: rgba(255, 255, 255, 0.05);
}

.role-btn-del {
  border-color: rgba(229, 115, 115, 0.3);
  color: var(--color-red, #e57373);
}

.role-btn-del:hover {
  background: rgba(229, 115, 115, 0.1);
}

.roles-empty {
  font-size: 12px;
  color: var(--color-tx4);
  padding: 12px 0;
}

.role-add {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.role-add-select {
  flex: 1;
  min-width: 180px;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  color: var(--color-tx);
  font: 13px var(--font-body);
  outline: none;
}

.role-add-select:focus {
  border-color: rgba(201, 168, 76, 0.4);
}

.role-add-role {
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  color: var(--color-tx);
  font: 13px var(--font-body);
  outline: none;
}

.role-add-role:focus {
  border-color: rgba(201, 168, 76, 0.4);
}

.btn-p {
  padding: 8px 16px;
  border-radius: 8px;
  border: none;
  background: linear-gradient(135deg, var(--color-gold), var(--color-gold-dark, #a88430));
  color: var(--color-bg, #0d0c14);
  cursor: pointer;
  font: 700 13px var(--font-body);
  transition: all 0.15s;
  white-space: nowrap;
}

.btn-p:hover {
  filter: brightness(1.1);
}

.roles-hint {
  font-size: 12px;
  color: var(--color-tx4);
  margin-top: 8px;
}

/* Users table */
.users-table {
  margin-top: 8px;
}

.users-header {
  display: flex;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 11px;
  font-weight: 700;
  color: var(--color-tx3);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.users-row {
  display: flex;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  align-items: center;
}

.users-col-account {
  flex: 1;
  min-width: 120px;
  font-size: 13px;
  color: var(--color-tx2);
}

.users-col-chars {
  flex: 1.5;
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  min-width: 100px;
}

.users-col-role {
  min-width: 80px;
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.users-no-chars,
.users-no-role {
  font-size: 12px;
  color: var(--color-tx4);
}
</style>
