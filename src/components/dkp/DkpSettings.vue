<script setup lang="ts">
import { ref, computed } from 'vue'
import { useDkpStore } from '@/stores/dkp'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import ConfirmModal from '@/components/shared/ConfirmModal.vue'
import type { RaidPointCategory } from '@/types'

const dkp = useDkpStore()
const auth = useAuthStore()
const { toast } = useToast()

// Config fields
const cfgDecay = ref(dkp.config.defaultDecayPercent)
const cfgMax = ref(dkp.config.maxDkpAmount)
const cfgStart = ref(dkp.config.startingBalance)
const cfgNeg = ref(String(dkp.config.allowNegativeBalance))
const cfgTxLimit = ref(dkp.config.transactionLimit || 50)
const cfgReasonLen = ref(dkp.config.reasonMaxLength || 200)
const configSaved = ref(false)

// Role management
const roleAddUser = ref('')
const roleAddRole = ref<'officer' | 'admin'>('officer')
const showRemoveModal = ref(false)
const removeUsername = ref('')

const roleEntries = computed(() => {
  const roles = dkp.config.roles || {}
  return Object.entries(roles)
    .sort((a, b) => {
      if (a[1] === 'admin' && b[1] !== 'admin') return -1
      if (b[1] === 'admin' && a[1] !== 'admin') return 1
      return a[0].localeCompare(b[0])
    })
})

async function saveConfig() {
  try {
    await dkp.saveConfig({
      defaultDecayPercent: cfgDecay.value,
      maxDkpAmount: cfgMax.value,
      startingBalance: cfgStart.value,
      allowNegativeBalance: cfgNeg.value === 'true',
      transactionLimit: cfgTxLimit.value,
      reasonMaxLength: cfgReasonLen.value,
    })
    configSaved.value = true
    setTimeout(() => { configSaved.value = false }, 2000)
    toast('Einstellungen gespeichert')
  } catch (e: unknown) {
    toast('Fehler: ' + (e instanceof Error ? e.message : 'Unbekannter Fehler'))
  }
}

async function addRole() {
  const username = roleAddUser.value.trim()
  if (!username) { toast('Benutzername eingeben'); return }
  try {
    await dkp.manageRoles('add', username, roleAddRole.value)
    toast(`${username} als ${roleAddRole.value === 'admin' ? 'Admin' : 'Offizier'} hinzugefügt`)
    roleAddUser.value = ''
  } catch (e: unknown) {
    toast('Fehler: ' + (e instanceof Error ? e.message : 'Unbekannter Fehler'))
  }
}

async function changeRole(username: string, currentRole: string) {
  const newRole = currentRole === 'admin' ? 'officer' : 'admin'
  try {
    await dkp.manageRoles('add', username, newRole as 'admin' | 'officer')
    toast(`${username} ist jetzt ${newRole === 'admin' ? 'Admin' : 'Offizier'}`)
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
  } catch (e: unknown) {
    toast('Fehler: ' + (e instanceof Error ? e.message : 'Unbekannter Fehler'))
  }
}

function isMe(username: string) {
  return auth.user && username === auth.user.username?.toLowerCase()
}

// Raid point categories
const categories = ref<RaidPointCategory[]>(
  (dkp.config.raidPointCategories || []).map(c => ({ ...c }))
)
const newCatName = ref('')
const newCatPoints = ref(10)

function addCategory() {
  const name = newCatName.value.trim()
  if (!name) { toast('Name eingeben'); return }
  categories.value.push({ id: crypto.randomUUID(), name, points: newCatPoints.value })
  newCatName.value = ''
  newCatPoints.value = 10
}

function removeCategory(id: string) {
  categories.value = categories.value.filter(c => c.id !== id)
}

async function saveCategories() {
  try {
    await dkp.saveConfig({ raidPointCategories: categories.value })
    toast('Raid-Punkte Kategorien gespeichert')
  } catch (e: unknown) {
    toast('Fehler: ' + (e instanceof Error ? e.message : 'Unbekannter Fehler'))
  }
}
</script>

<template>
  <div class="card dkp-form" style="padding:28px;max-width:560px">
    <div class="card-t">DKP-Einstellungen</div>
    <p style="font-size:13px;color:var(--color-tx3);margin-bottom:16px">
      Konfiguriere das DKP-System. Änderungen werden sofort gespeichert.
    </p>

    <div class="dkp-cfg-row">
      <div class="dkp-cfg-label">Standard-Verfall %<small>Vorgabewert für wöchentlichen Verfall</small></div>
      <div class="dkp-cfg-input"><input id="cfg-decay" v-model.number="cfgDecay" type="number" min="1" max="100"></div>
    </div>
    <div class="dkp-cfg-row">
      <div class="dkp-cfg-label">Max. DKP pro Aktion<small>Obergrenze für Vergabe und Ausgabe</small></div>
      <div class="dkp-cfg-input"><input id="cfg-max" v-model.number="cfgMax" type="number" min="1" max="100000"></div>
    </div>
    <div class="dkp-cfg-row">
      <div class="dkp-cfg-label">Startwert neue Spieler<small>DKP-Stand bei erster Vergabe</small></div>
      <div class="dkp-cfg-input"><input id="cfg-start" v-model.number="cfgStart" type="number" min="0" max="100000"></div>
    </div>
    <div class="dkp-cfg-row">
      <div class="dkp-cfg-label">Negative DKP erlauben<small>Dürfen Spieler ins Minus gehen?</small></div>
      <div class="dkp-cfg-input">
        <select id="cfg-neg" v-model="cfgNeg">
          <option value="true">Ja</option>
          <option value="false">Nein</option>
        </select>
      </div>
    </div>
    <div class="dkp-cfg-row">
      <div class="dkp-cfg-label">Transaktions-Limit<small>Max. Transaktionen in der Übersicht</small></div>
      <div class="dkp-cfg-input"><input id="cfg-txlimit" v-model.number="cfgTxLimit" type="number" min="10" max="500"></div>
    </div>
    <div class="dkp-cfg-row">
      <div class="dkp-cfg-label">Max. Zeichenlänge Grund<small>Für Vergabe- und Beute-Gründe</small></div>
      <div class="dkp-cfg-input"><input id="cfg-reasonlen" v-model.number="cfgReasonLen" type="number" min="50" max="500"></div>
    </div>

    <div class="brow" style="margin-top:18px">
      <button class="btn-p" @click="saveConfig">Speichern</button>
      <span class="dkp-cfg-saved" :class="{ show: configSaved }" id="cfg-saved">Gespeichert!</span>
    </div>

    <!-- Role management -->
    <div class="dkp-roles-section">
      <div class="card-t">Rollen-Verwaltung</div>
      <p style="font-size:13px;color:var(--color-tx3);margin:8px 0 12px">
        <strong>Admin</strong> = Volle Kontrolle (Einstellungen, Verfall, Rollen).
        <strong>Offizier</strong> = DKP vergeben und Beute verbuchen.
      </p>
      <div class="dkp-role-list">
        <div v-for="[uname, role] in roleEntries" :key="uname" class="dkp-role-row">
          <span class="dkp-role-name">{{ uname }}{{ isMe(uname) ? ' (Du)' : '' }}</span>
          <span class="dkp-role-badge" :class="role === 'admin' ? 'dkp-role-admin' : 'dkp-role-officer'">
            {{ role === 'admin' ? 'Admin' : 'Offizier' }}
          </span>
          <template v-if="!isMe(uname)">
            <button class="dkp-role-btn" @click="changeRole(uname, role)">
              {{ role === 'admin' ? '→ Offizier' : '→ Admin' }}
            </button>
            <button class="dkp-role-btn dkp-role-del" @click="confirmRemoveRole(uname)">Entfernen</button>
          </template>
        </div>
        <div v-if="!roleEntries.length" style="font-size:12px;color:var(--color-tx4)">Keine Rollen zugewiesen.</div>
      </div>

      <div class="dkp-role-add">
        <input id="dkp-role-user" v-model="roleAddUser" type="text" placeholder="Benutzername">
        <select id="dkp-role-type" v-model="roleAddRole">
          <option value="officer">Offizier</option>
          <option value="admin">Admin</option>
        </select>
        <button class="btn-p" style="padding:8px 16px;font-size:13px" @click="addRole">Hinzufügen</button>
      </div>
    </div>

    <!-- Raid Point Categories -->
    <div class="dkp-roles-section">
      <div class="card-t">Raid-Punkte Kategorien</div>
      <p style="font-size:13px;color:var(--color-tx3);margin:8px 0 12px">
        Definiere Kategorien fuer die Punktvergabe beim Raid-Abschluss (z.B. Puenktlichkeit, Bosskill, Full Clear).
      </p>
      <div class="dkp-role-list">
        <div v-for="cat in categories" :key="cat.id" class="dkp-role-row">
          <span class="dkp-role-name">{{ cat.name }}</span>
          <span class="rp-cat-points">{{ cat.points }} DKP</span>
          <input
            v-model.number="cat.points"
            type="number"
            min="1"
            class="rp-cat-input"
          >
          <button class="dkp-role-btn dkp-role-del" @click="removeCategory(cat.id)">Entfernen</button>
        </div>
        <div v-if="!categories.length" style="font-size:12px;color:var(--color-tx4)">
          Keine Kategorien definiert. Fuege welche hinzu, um Raid-Punkte vergeben zu koennen.
        </div>
      </div>
      <div class="dkp-role-add">
        <input v-model="newCatName" type="text" placeholder="z.B. Puenktlichkeit">
        <input v-model.number="newCatPoints" type="number" min="1" placeholder="DKP" class="rp-cat-input">
        <button class="btn-p" style="padding:8px 16px;font-size:13px" @click="addCategory">Hinzufuegen</button>
      </div>
      <div class="brow" style="margin-top:14px">
        <button class="btn-p" @click="saveCategories">Kategorien speichern</button>
      </div>
    </div>
  </div>

  <ConfirmModal
    :open="showRemoveModal"
    title="Rolle entfernen"
    :message="`Wirklich <strong>${removeUsername}</strong> als DKP-Verwalter entfernen?`"
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
}

.card-t {
  font: 600 15px var(--font-heading);
  color: var(--color-gold);
  margin-bottom: 16px;
}

.dkp-cfg-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.dkp-cfg-label {
  flex: 1;
  font-size: 13px;
  color: var(--color-tx2);
}

.dkp-cfg-label small {
  display: block;
  font-size: 11px;
  color: var(--color-tx4);
  margin-top: 2px;
}

.dkp-cfg-input {
  width: 120px;
}

.dkp-cfg-input input,
.dkp-cfg-input select {
  width: 100%;
  padding: 6px 10px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  color: var(--color-tx);
  font: 13px var(--font-body);
  outline: none;
}

.dkp-cfg-input input:focus,
.dkp-cfg-input select:focus {
  border-color: rgba(201, 168, 76, 0.4);
}

.brow {
  display: flex;
  gap: 10px;
  align-items: center;
}

.btn-p {
  padding: 10px 20px;
  border-radius: 8px;
  border: none;
  background: linear-gradient(135deg, var(--color-gold), var(--color-gold-dark, #a88430));
  color: var(--color-bg, #0d0c14);
  cursor: pointer;
  font: 700 14px var(--font-body);
  transition: all 0.15s;
}

.btn-p:hover {
  filter: brightness(1.1);
}

.dkp-cfg-saved {
  font-size: 12px;
  color: var(--color-green);
  opacity: 0;
  transition: opacity 0.3s;
}

.dkp-cfg-saved.show {
  opacity: 1;
}

.dkp-roles-section {
  margin-top: 28px;
  padding-top: 20px;
  border-top: 1px solid var(--color-border);
}

.dkp-role-list {
  margin-bottom: 16px;
}

.dkp-role-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  flex-wrap: wrap;
}

.dkp-role-name {
  font-size: 13px;
  color: var(--color-tx2);
  flex: 1;
  min-width: 100px;
}

.dkp-role-badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.dkp-role-admin {
  background: rgba(201, 168, 76, 0.15);
  color: var(--color-gold);
}

.dkp-role-officer {
  background: rgba(102, 187, 106, 0.15);
  color: var(--color-green);
}

.dkp-role-btn {
  padding: 3px 8px;
  border-radius: 4px;
  border: 1px solid var(--color-border);
  background: none;
  color: var(--color-tx3);
  cursor: pointer;
  font-size: 11px;
  transition: all 0.15s;
}

.dkp-role-btn:hover {
  background: rgba(255, 255, 255, 0.05);
}

.dkp-role-del {
  border-color: rgba(229, 115, 115, 0.3);
  color: var(--color-red, #e57373);
}

.dkp-role-del:hover {
  background: rgba(229, 115, 115, 0.1);
}

.dkp-role-add {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.dkp-role-add input,
.dkp-role-add select {
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  color: var(--color-tx);
  font: 13px var(--font-body);
  outline: none;
}

.dkp-role-add input {
  flex: 1;
  min-width: 120px;
}

.dkp-role-add input:focus,
.dkp-role-add select:focus {
  border-color: rgba(201, 168, 76, 0.4);
}

.rp-cat-points {
  font-size: 12px;
  color: var(--color-gold);
  font-weight: 600;
  min-width: 60px;
}

.rp-cat-input {
  width: 70px;
  padding: 4px 8px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  color: var(--color-tx);
  font: 13px var(--font-body);
  outline: none;
}

.rp-cat-input:focus {
  border-color: rgba(201, 168, 76, 0.4);
}
</style>
