<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRaidsStore } from '@/stores/raids'
import { useAuthStore } from '@/stores/auth'
import { useEntriesStore } from '@/stores/entries'
import { useToast } from '@/composables/useToast'
import { useRaidSignup } from '@/composables/useRaidSignup'
import { TBC_RAIDS, ROLES, ROLE_COLORS, ROLE_ICONS, RR_TANK, RR_HEAL, RR_DPS, CLASS_SPECS, WOW_ICONS } from '@/lib/constants'
import { cc } from '@/lib/utils'
import ClassIcon from '@/components/shared/ClassIcon.vue'
import ConfirmModal from '@/components/shared/ConfirmModal.vue'
import SignupModal from '@/components/raids/SignupModal.vue'
import RaidForm from '@/components/raids/RaidForm.vue'
import RaidCompletionForm from '@/components/raids/RaidCompletionForm.vue'
import OrgaSignupModal from '@/components/raids/OrgaSignupModal.vue'
import { useDkpRole } from '@/composables/useDkpRole'
import type { Raid, RaidSignup as RaidSignupType } from '@/types'
import type { RoleName } from '@/lib/constants'

const route = useRoute()
const router = useRouter()
const raidsStore = useRaidsStore()
const authStore = useAuthStore()
const entriesStore = useEntriesStore()
const { toast } = useToast()

const raidId = computed(() => route.params.id as string)

const {
  showForm: showSignup,
  submitting,
  selectedChar,
  selectedClass,
  selectedStatus,
  selectedSpecs,
  note: signupNote,
  myChars,
  mySignup,
  isRaidPast,
  deadlinePassed,
  isOwner,
  canManageRaid,
  canSignup,
  specRole,
  openForm: openSignupForm,
  closeForm: closeSignupForm,
  onCharChange,
  onClassChange,
  toggleSpec,
  doSignup,
  doUnsignup,
} = useRaidSignup(() => raidId.value)

const raid = computed(() => raidsStore.getRaid(raidId.value))
const editing = ref(false)
const showDeleteConfirm = ref(false)
const showLockConfirm = ref(false)
const discordPosting = ref(false)
const compOpen = ref(false)
const showCompletion = ref(false)
const showOrgaSignup = ref(false)
const { isDkpOfficer } = useDkpRole()

const inst = computed(() =>
  TBC_RAIDS.find(i => i.name === raid.value?.instance) || { name: raid.value?.instance || '', tier: '?' }
)

const activeSignups = computed(() =>
  (raid.value?.signups || []).filter(s => s.status !== 'declined' && s.status !== 'benched')
)

const benchedSignups = computed(() =>
  (raid.value?.signups || []).filter(s => s.status === 'benched')
)

const declinedSignups = computed(() =>
  (raid.value?.signups || []).filter(s => s.status === 'declined')
)

const tentativeCount = computed(() =>
  activeSignups.value.filter(s => s.status === 'tentative').length
)

const confirmedCount = computed(() =>
  activeSignups.value.filter(s => s.status === 'confirmed').length
)

const total = computed(() => activeSignups.value.length)
const pct = computed(() => raid.value ? Math.min(100, Math.round(total.value / raid.value.maxPlayers * 100)) : 0)

const barClass = computed(() => {
  if (!raid.value) return ''
  if (total.value > raid.value.maxPlayers) return 'over'
  if (total.value === raid.value.maxPlayers) return 'full'
  return ''
})

const is10 = computed(() => (raid.value?.maxPlayers || 25) <= 10)

const roleCounts = computed(() => {
  const counts: Record<RoleName, number> = { Tank: 0, Heiler: 0, DPS: 0 }
  activeSignups.value.forEach(s => {
    if (s.role === 'Tank') counts.Tank++
    else if (s.role === 'Heiler') counts.Heiler++
    else counts.DPS++
  })
  return counts
})

const roleTargets = computed(() => ({
  Tank: is10.value ? 2 : RR_TANK,
  Heiler: is10.value ? 2 : RR_HEAL,
  DPS: is10.value ? 6 : RR_DPS,
}))

function fmtDate(d: string): string {
  if (!d) return ''
  const [y, m, dd] = d.split('-')
  return `${dd}.${m}.${y}`
}

function fmtDeadline(dl: string): string {
  const d = new Date(dl)
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function signupsByRole(role: RoleName): RaidSignupType[] {
  return activeSignups.value.filter(s => s.role === role)
}

// Actions
async function toggleLock() {
  if (!raid.value) return
  try {
    if (raid.value.locked) {
      await raidsStore.unlock(raidId.value)
      toast('Raid entsperrt')
    } else {
      await raidsStore.lock(raidId.value)
      toast('Raid gesperrt')
    }
  } catch (e: unknown) {
    toast('Fehler: ' + (e instanceof Error ? e.message : 'Unbekannter Fehler'))
  }
  showLockConfirm.value = false
}

async function deleteRaid() {
  try {
    await raidsStore.remove(raidId.value)
    toast('Raid geloescht')
    router.push('/raids')
  } catch (e: unknown) {
    toast('Fehler: ' + (e instanceof Error ? e.message : 'Unbekannter Fehler'))
  }
  showDeleteConfirm.value = false
}

async function postDiscord() {
  discordPosting.value = true
  try {
    await raidsStore.postDiscord(raidId.value)
    toast('In Discord gepostet')
  } catch (e: unknown) {
    toast('Discord: ' + (e instanceof Error ? e.message : 'Unbekannter Fehler'))
  } finally {
    discordPosting.value = false
  }
}

async function onConfirmPlayer(targetUserId: string) {
  try {
    await raidsStore.confirmPlayer(raidId.value, targetUserId)
    toast('Spieler bestaetigt')
  } catch (e: unknown) { toast('Fehler: ' + (e instanceof Error ? e.message : 'Unbekannter Fehler')) }
}

async function onUnconfirmPlayer(targetUserId: string) {
  try {
    await raidsStore.unconfirmPlayer(raidId.value, targetUserId)
    toast('Bestaetigung zurueckgenommen')
  } catch (e: unknown) { toast('Fehler: ' + (e instanceof Error ? e.message : 'Unbekannter Fehler')) }
}

async function onBenchPlayer(targetUserId: string) {
  try {
    await raidsStore.benchPlayer(raidId.value, targetUserId)
    toast('Spieler gebankt')
  } catch (e: unknown) { toast('Fehler: ' + (e instanceof Error ? e.message : 'Unbekannter Fehler')) }
}

async function onRemovePlayer(targetUserId: string) {
  try {
    await raidsStore.removePlayer(raidId.value, targetUserId)
    toast('Spieler entfernt')
  } catch (e: unknown) { toast('Fehler: ' + (e instanceof Error ? e.message : 'Unbekannter Fehler')) }
}

async function onAssignSpec(targetUserId: string, spec: string) {
  try {
    await raidsStore.assignSpec(raidId.value, targetUserId, spec || null)
    toast(spec ? 'Spec zugewiesen: ' + spec : 'Zuweisung entfernt')
  } catch (e: unknown) { toast('Fehler: ' + (e instanceof Error ? e.message : 'Unbekannter Fehler')) }
}

async function onOrgaSignup(payload: { charName: string; className: string; role: string; status: string; note: string; targetUserId?: string }) {
  try {
    await raidsStore.signupOther(raidId.value, {
      charName: payload.charName,
      className: payload.className,
      role: payload.role,
      status: payload.status,
      note: payload.note || undefined,
      targetUserId: payload.targetUserId,
    })
    toast(payload.charName + ' angemeldet')
    showOrgaSignup.value = false
  } catch (e: unknown) {
    toast('Fehler: ' + (e instanceof Error ? e.message : 'Unbekannter Fehler'))
  }
}

function onEditSaved() {
  editing.value = false
}

function getMyStatusLabel(): string {
  if (!mySignup.value) return ''
  const s = mySignup.value.status
  if (s === 'confirmed') return 'Bestaetigt'
  if (s === 'accepted') return 'Angemeldet'
  if (s === 'tentative') return 'Vielleicht'
  return 'Abgesagt'
}

function getMyStatusColor(): string {
  if (!mySignup.value) return ''
  const s = mySignup.value.status
  if (s === 'confirmed' || s === 'accepted') return 'var(--color-heal)'
  if (s === 'tentative') return 'var(--color-ylw)'
  return 'var(--color-dps)'
}
</script>

<template>
  <div id="v-raids">
    <div v-if="!raid" class="empty">Raid nicht gefunden.</div>

    <template v-else>
      <!-- Back link -->
      <router-link to="/raids" class="back-link">Alle Raids</router-link>

      <!-- Edit mode -->
      <template v-if="editing">
        <RaidForm :edit-raid="raid" @saved="onEditSaved" @cancel="editing = false" />
      </template>

      <template v-else>
        <!-- Header -->
        <div class="raid-detail-hdr">
          <div class="raid-hdr">
            <span class="raid-inst">{{ raid.instance }}</span>
            <span class="raid-tier">{{ inst.tier }}</span>
          </div>
          <div class="raid-meta">
            <span>{{ fmtDate(raid.date) }}</span>
            <span>{{ raid.time }} Uhr</span>
            <span>{{ raid.maxPlayers }} Spieler</span>
            <span v-if="raid.createdByName" class="raid-creator">von {{ raid.createdByName }}</span>
          </div>

          <div class="raid-bar">
            <div :class="['raid-bar-fill', barClass]" :style="{ width: pct + '%' }"></div>
          </div>

          <!-- Role counts -->
          <div class="raid-roles">
            <span :style="{ background: ROLE_COLORS.Tank + '18', color: ROLE_COLORS.Tank }">
              {{ ROLE_ICONS.Tank }} {{ roleCounts.Tank }}{{ is10 ? '' : '/' + roleTargets.Tank }} Tank
            </span>
            <span :style="{ background: ROLE_COLORS.Heiler + '18', color: ROLE_COLORS.Heiler }">
              {{ ROLE_ICONS.Heiler }} {{ roleCounts.Heiler }}{{ is10 ? '' : '/' + roleTargets.Heiler }} Heiler
            </span>
            <span :style="{ background: ROLE_COLORS.DPS + '18', color: ROLE_COLORS.DPS }">
              {{ ROLE_ICONS.DPS }} {{ roleCounts.DPS }}{{ is10 ? '' : '/' + roleTargets.DPS }} DPS
            </span>
          </div>

          <!-- Locked / deadline status -->
          <div v-if="raid.locked" class="raid-deadline closed">
            <span>Raid gesperrt</span>
            <span class="dl-badge closed">Gesperrt</span>
          </div>
          <div v-else-if="raid.deadline" :class="['raid-deadline', deadlinePassed ? 'closed' : 'open']">
            <span>Anmeldefrist: {{ fmtDeadline(raid.deadline) }}</span>
            <span :class="['dl-badge', deadlinePassed ? 'closed' : 'open']">
              {{ deadlinePassed ? 'Geschlossen' : 'Offen' }}
            </span>
          </div>

          <div v-if="raid.description" class="raid-desc">{{ raid.description }}</div>
          <div v-if="raid.notes" class="raid-notes">{{ raid.notes }}</div>
        </div>

        <!-- Signups by role -->
        <div v-if="activeSignups.length || benchedSignups.length || declinedSignups.length" class="raid-signups">
          <template v-for="role in ROLES" :key="role">
            <div v-if="signupsByRole(role).length" class="raid-signups-group">
              <div class="raid-signups-t" :style="{ color: ROLE_COLORS[role] }">
                {{ ROLE_ICONS[role] }} {{ role }} ({{ signupsByRole(role).length }})
              </div>
              <div
                v-for="s in signupsByRole(role)"
                :key="s.userId || s.charName"
                :class="['raid-signup-row', { confirmed: s.status === 'confirmed' }]"
              >
                <span class="raid-signup-name" :style="{ color: s.className ? cc(s.className) : 'var(--color-tx)' }">
                  <ClassIcon v-if="s.className" :class-name="s.className" size="sm" />
                  {{ s.charName }}
                </span>
                <span v-if="s.className" class="signup-class">{{ s.className }}</span>
                <span v-if="s.assignedSpec" class="signup-assigned">{{ s.assignedSpec }}</span>
                <span v-if="s.status === 'confirmed'" class="raid-signup-status conf">Bestaetigt</span>
                <span v-if="s.status === 'tentative'" class="raid-signup-status tent">Vielleicht</span>
                <span v-if="s.note" class="signup-note">{{ s.note }}</span>

                <!-- Raid manager controls -->
                <span v-if="canManageRaid && !isRaidPast" class="raid-signup-actions">
                  <template v-if="s.offeredSpecs && s.offeredSpecs.length > 1">
                    <select
                      class="spec-assign-select"
                      :value="s.assignedSpec || ''"
                      @change="onAssignSpec(s.userId!, ($event.target as HTMLSelectElement).value)"
                    >
                      <option value="">-- Spec --</option>
                      <option v-for="sp in s.offeredSpecs" :key="sp" :value="sp">{{ sp }}</option>
                    </select>
                  </template>
                  <button
                    v-if="s.status === 'confirmed'"
                    class="btn-unconfirm"
                    @click="onUnconfirmPlayer(s.userId!)"
                  >Zuruecknehmen</button>
                  <button
                    v-else
                    class="btn-confirm"
                    @click="onConfirmPlayer(s.userId!)"
                  >Bestaetigen</button>
                  <button class="btn-bench" @click="onBenchPlayer(s.userId!)">Bank</button>
                  <button class="btn-kick" @click="onRemovePlayer(s.userId!)">Entfernen</button>
                </span>
              </div>
            </div>
          </template>

          <!-- Benched -->
          <div v-if="benchedSignups.length" class="raid-signups-group">
            <div class="raid-signups-t" style="color: #ff9800">Bank ({{ benchedSignups.length }})</div>
            <div v-for="s in benchedSignups" :key="s.userId || s.charName" class="raid-signup-row">
              <span class="raid-signup-name" style="color: var(--color-tx4)">{{ s.charName }}</span>
              <span class="raid-signup-status bench">Gebankt</span>
              <span v-if="canManageRaid && !isRaidPast" class="raid-signup-actions">
                <button class="btn-confirm" @click="onUnconfirmPlayer(s.userId!)">Aufnehmen</button>
                <button class="btn-kick" @click="onRemovePlayer(s.userId!)">Entfernen</button>
              </span>
            </div>
          </div>

          <!-- Declined -->
          <div v-if="declinedSignups.length" class="raid-signups-group declined-group">
            <div class="raid-signups-t" style="color: var(--color-dps)">Abgesagt ({{ declinedSignups.length }})</div>
            <div v-for="s in declinedSignups" :key="s.userId || s.charName" class="raid-signup-row">
              <span class="raid-signup-name declined-name">{{ s.charName }}</span>
              <span v-if="s.note" class="signup-note">{{ s.note }}</span>
            </div>
          </div>
        </div>

        <!-- My signup status -->
        <div v-if="authStore.isLoggedIn && !isRaidPast && mySignup" class="my-signup-status" :style="{ color: getMyStatusColor() }">
          Du bist als <strong>{{ mySignup.charName }}</strong>
          ({{ mySignup.assignedSpec || mySignup.offeredSpecs?.join(', ') || mySignup.role }})
          {{ getMyStatusLabel().toLowerCase() }}
          <template v-if="mySignup.status === 'confirmed'"> &#10003;</template>
          <template v-if="mySignup.assignedSpec"> -- Zugewiesen: {{ mySignup.assignedSpec }}</template>
        </div>

        <!-- Locked/deadline messages -->
        <div v-if="authStore.isLoggedIn && !isRaidPast && !mySignup && raid.locked && !canManageRaid" class="locked-msg">
          Raid gesperrt -- Anmeldung nicht mehr moeglich.
        </div>
        <div v-if="authStore.isLoggedIn && !isRaidPast && !mySignup && !raid.locked && deadlinePassed && !canManageRaid" class="locked-msg">
          Anmeldefrist abgelaufen -- Anmeldung nicht mehr moeglich.
        </div>

        <!-- Actions -->
        <div v-if="authStore.isLoggedIn && !isRaidPast" class="raid-actions">
          <button v-if="!mySignup && canSignup" class="btn-signup" @click="openSignupForm">Anmelden</button>
          <template v-if="mySignup">
            <button v-if="mySignup.status !== 'declined' && canSignup" class="btn-unsignup" @click="doUnsignup">Abmelden</button>
            <button v-if="canSignup" class="btn-raid-edit" @click="openSignupForm">Aendern</button>
          </template>
          <template v-if="canManageRaid">
            <button class="btn-orga-signup" @click="showOrgaSignup = true">Spieler anmelden</button>
            <button class="btn-raid-edit" @click="editing = true">Bearbeiten</button>
            <button class="btn-raid-lock" @click="showLockConfirm = true">
              {{ raid.locked ? 'Entsperren' : 'Sperren' }}
            </button>
            <button class="btn-discord" :disabled="discordPosting" @click="postDiscord">
              {{ discordPosting ? 'Senden...' : 'Discord' }}
            </button>
          </template>
          <button v-if="isOwner" class="btn-raid-del" @click="showDeleteConfirm = true">Loeschen</button>
          <button v-if="isDkpOfficer && activeSignups.length" class="btn-complete" @click="showCompletion = !showCompletion">
            {{ showCompletion ? 'Abbrechen' : 'Raid abschliessen' }}
          </button>
        </div>

        <!-- Also show completion button for past raids -->
        <div v-if="authStore.isLoggedIn && isRaidPast && isDkpOfficer && activeSignups.length && !showCompletion" class="raid-actions">
          <button class="btn-complete" @click="showCompletion = true">Raid abschliessen</button>
        </div>

        <!-- Raid completion form -->
        <RaidCompletionForm
          v-if="showCompletion && raid"
          :raid-instance="raid.instance"
          :raid-date="raid.date"
          :active-signups="activeSignups"
          :benched-signups="benchedSignups"
          @close="showCompletion = false"
          @completed="showCompletion = false"
        />

        <!-- Signup modal -->
        <SignupModal
          :open="showSignup"
          :my-chars="myChars"
          :selected-char="selectedChar"
          :selected-class="selectedClass"
          :selected-status="selectedStatus"
          :selected-specs="selectedSpecs"
          :note="signupNote"
          :submitting="submitting"
          @char-change="onCharChange"
          @class-change="onClassChange"
          @toggle-spec="toggleSpec"
          @update:selected-char="selectedChar = $event"
          @update:selected-class="selectedClass = $event"
          @update:selected-status="selectedStatus = $event"
          @update:note="signupNote = $event"
          @confirm="doSignup"
          @cancel="closeSignupForm"
        />

        <!-- Orga signup modal (add player from pool) -->
        <OrgaSignupModal
          :open="showOrgaSignup"
          :entries="entriesStore.entries"
          :signups="raid.signups || []"
          @confirm="onOrgaSignup"
          @cancel="showOrgaSignup = false"
        />

        <!-- Confirm modals -->
        <ConfirmModal
          :open="showDeleteConfirm"
          title="Raid loeschen"
          :message="`Soll der Raid <strong>${raid.instance}</strong> wirklich geloescht werden?`"
          @confirm="deleteRaid"
          @cancel="showDeleteConfirm = false"
        />
        <ConfirmModal
          :open="showLockConfirm"
          :title="raid.locked ? 'Raid entsperren' : 'Raid sperren'"
          :message="raid.locked
            ? `Soll der Raid <strong>${raid.instance}</strong> wieder entsperrt werden?`
            : `Soll der Raid <strong>${raid.instance}</strong> gesperrt werden?`"
          @confirm="toggleLock"
          @cancel="showLockConfirm = false"
        />
      </template>
    </template>
  </div>
</template>

<style scoped>
#v-raids {
  max-width: 860px;
  margin: 0 auto;
}
.back-link {
  display: inline-block;
  font-size: 13px;
  color: var(--color-gold);
  text-decoration: none;
  margin-bottom: 16px;
}
.back-link:hover { text-decoration: underline; }
.raid-detail-hdr {
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
}
.raid-hdr {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.raid-inst {
  font: 700 20px var(--font-heading);
  color: var(--color-gold);
}
.raid-tier {
  font-size: 11px;
  color: var(--color-tx3);
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.04);
}
.raid-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 13px;
  color: var(--color-tx2);
  margin-bottom: 12px;
}
.raid-creator { font-size: 11px; color: var(--color-tx4); }
.raid-bar {
  height: 6px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 12px;
}
.raid-bar-fill {
  height: 100%;
  border-radius: 3px;
  background: var(--color-gold);
  transition: width 0.4s;
}
.raid-bar-fill.full { background: var(--color-heal); }
.raid-bar-fill.over { background: var(--color-dps); }
.raid-roles {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}
.raid-roles span {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 4px;
  font-weight: 600;
}
.raid-deadline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 6px;
  margin-bottom: 8px;
}
.raid-deadline.open { background: rgba(102, 187, 106, 0.06); color: var(--color-heal); }
.raid-deadline.closed { background: rgba(229, 115, 115, 0.06); color: var(--color-dps); }
.dl-badge { font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 3px; }
.dl-badge.open { background: rgba(102, 187, 106, 0.15); }
.dl-badge.closed { background: rgba(229, 115, 115, 0.15); }
.raid-desc { font-size: 12px; color: var(--color-tx2); margin-bottom: 4px; }
.raid-notes {
  font-size: 12px; color: var(--color-tx3); font-style: italic;
  padding: 6px 10px; border-radius: 6px; background: rgba(0, 0, 0, 0.1);
}

/* Signups */
.raid-signups {
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
}
.raid-signups-group { margin-bottom: 12px; }
.raid-signups-t {
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 6px;
}
.raid-signup-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 4px 8px;
  border-radius: 4px;
  margin-bottom: 2px;
}
.raid-signup-row.confirmed { background: rgba(102, 187, 106, 0.06); }
.raid-signup-name {
  font-weight: 600;
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.signup-class { font-size: 11px; color: var(--color-tx4); }
.signup-assigned { font-size: 10px; color: var(--color-heal); }
.raid-signup-status { font-size: 10px; padding: 1px 6px; border-radius: 3px; font-weight: 600; }
.raid-signup-status.conf { background: rgba(102, 187, 106, 0.15); color: var(--color-heal); }
.raid-signup-status.tent { background: rgba(229, 194, 68, 0.15); color: var(--color-ylw); }
.raid-signup-status.bench { background: rgba(255, 152, 0, 0.15); color: #ff9800; }
.signup-note { font-size: 11px; color: var(--color-tx4); font-style: italic; }
.declined-name { color: var(--color-tx4); text-decoration: line-through; }
.declined-group { border-color: rgba(229, 115, 115, 0.08); }

.raid-signup-actions {
  display: inline-flex;
  gap: 4px;
  margin-left: auto;
}
.raid-signup-actions button {
  padding: 2px 8px;
  font-size: 11px;
  border-radius: 4px;
  border: 1px solid var(--color-border);
  background: none;
  cursor: pointer;
  white-space: nowrap;
}
.btn-confirm { color: var(--color-heal); }
.btn-unconfirm { color: var(--color-ylw); }
.btn-bench { color: #ff9800; }
.btn-kick { color: var(--color-dps); }
.spec-assign-select {
  font-size: 11px;
  padding: 2px 4px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-tx);
}

.my-signup-status {
  font-size: 12px;
  padding: 8px 12px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.15);
  margin-bottom: 12px;
}
.locked-msg {
  font-size: 12px;
  color: var(--color-dps);
  padding: 8px 12px;
  border-radius: 6px;
  background: rgba(229, 115, 115, 0.08);
  margin-bottom: 12px;
}

/* Actions */
.raid-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.raid-actions button {
  padding: 8px 16px;
  border-radius: 6px;
  font: 13px var(--font-body);
  cursor: pointer;
  white-space: nowrap;
}
.btn-signup {
  border: none;
  background: linear-gradient(135deg, var(--color-gold), var(--color-gold-dark));
  color: var(--color-bg);
  font-weight: 700;
}
.btn-unsignup {
  border: 1px solid var(--color-dps);
  background: none;
  color: var(--color-dps);
}
.btn-raid-edit {
  border: 1px solid var(--color-border);
  background: none;
  color: var(--color-tx2);
}
.btn-raid-lock {
  border: 1px solid rgba(201, 168, 76, 0.3);
  background: none;
  color: var(--color-gold);
}
.btn-discord {
  border: 1px solid rgba(114, 137, 218, 0.3);
  background: none;
  color: #7289da;
}
.btn-discord:disabled { opacity: 0.5; }
.btn-complete {
  border: 1px solid rgba(102, 187, 106, 0.3);
  background: none;
  color: var(--color-heal);
  font-weight: 600;
}
.btn-orga-signup {
  border: 1px solid rgba(102, 187, 106, 0.3);
  background: none;
  color: var(--color-heal);
  font-weight: 600;
}
.btn-raid-del {
  border: 1px solid rgba(229, 115, 115, 0.3);
  background: none;
  color: var(--color-dps);
}

.empty {
  text-align: center;
  padding: 40px 20px;
  color: var(--color-tx3);
  font-size: 14px;
}
</style>
