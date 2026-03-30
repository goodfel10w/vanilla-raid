<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useRaidsStore } from '@/stores/raids'
import { useAuthStore } from '@/stores/auth'
import { useEntriesStore } from '@/stores/entries'
import { useKaraSignupsStore } from '@/stores/karaSignups'
import { DAY_SHORT, ROLE_COLORS } from '@/lib/constants'
import type { RoleName } from '@/lib/constants'
import { cc, specsToRoles } from '@/lib/utils'
import RaidCard from '@/components/raids/RaidCard.vue'
import RaidForm from '@/components/raids/RaidForm.vue'
import RaidCalendarWeek from '@/components/raids/RaidCalendarWeek.vue'
import RaidCalendarMonth from '@/components/raids/RaidCalendarMonth.vue'
import KaraSignupCard from '@/components/dashboard/KaraSignupCard.vue'
import ClassIcon from '@/components/shared/ClassIcon.vue'
import type { Raid } from '@/types'

const router = useRouter()
const raidsStore = useRaidsStore()
const authStore = useAuthStore()
const entriesStore = useEntriesStore()
const karaSignupsStore = useKaraSignupsStore()

const hasAnyEntry = computed(() => {
  if (!authStore.user) return false
  return entriesStore.entries.some(e => e.userId === authStore.user!.userId)
})

const showSignupList = ref(false)

onMounted(() => {
  if (authStore.isLoggedIn) {
    karaSignupsStore.load(0)
  }
})

function signupRoles(signup: { className: string; specs: string[]; roles?: RoleName[] }): RoleName[] {
  if (signup.roles?.length) return signup.roles
  return specsToRoles(signup.className, signup.specs)
}

function roleColor(role: RoleName): string {
  return ROLE_COLORS[role]
}

type ViewMode = 'list' | 'create' | 'edit'
type CalMode = 'list' | 'week' | 'month'
type SizeFilter = 'all' | '10' | '25'

const viewMode = ref<ViewMode>('list')
const calMode = ref<CalMode>('list')
const sizeFilter = ref<SizeFilter>('all')
const editingRaid = ref<Raid | null>(null)

const filteredRaids = computed(() => {
  if (sizeFilter.value === 'all') return raidsStore.raids
  const sz = parseInt(sizeFilter.value)
  return raidsStore.raids.filter(r => r.maxPlayers === sz)
})

const upcomingRaids = computed(() => {
  const today = new Date().toISOString().slice(0, 10)
  return filteredRaids.value
    .filter(r => r.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
})

const pastRaids = computed(() => {
  const today = new Date().toISOString().slice(0, 10)
  return filteredRaids.value
    .filter(r => r.date < today)
    .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time))
})

function openCreate() {
  editingRaid.value = null
  viewMode.value = 'create'
}

function onFormSaved() {
  viewMode.value = 'list'
  editingRaid.value = null
}

function onFormCancel() {
  viewMode.value = 'list'
  editingRaid.value = null
}

function goToRaid(id: string) {
  router.push(`/raids/${id}`)
}

function onCalSelectRaid(id: string) {
  calMode.value = 'list'
  setTimeout(() => {
    const card = document.getElementById('raid-' + id)
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' })
      card.style.outline = '2px solid var(--color-gold)'
      setTimeout(() => { card.style.outline = '' }, 2000)
    }
  }, 50)
}
</script>

<template>
  <div id="v-raids">
    <!-- Form mode -->
    <template v-if="viewMode === 'create' || viewMode === 'edit'">
      <div class="raid-tab-toggle">
        <button class="rt-btn" @click="onFormCancel">Uebersicht</button>
        <button class="rt-btn active">
          {{ viewMode === 'edit' ? 'Raid bearbeiten' : 'Raid erstellen' }}
        </button>
      </div>
      <RaidForm
        :edit-raid="editingRaid"
        @saved="onFormSaved"
        @cancel="onFormCancel"
      />
    </template>

    <!-- List/Calendar mode -->
    <template v-else>
      <!-- View mode toggle -->
      <div class="raid-tab-toggle">
        <button
          :class="['rt-btn', { active: calMode === 'list' }]"
          @click="calMode = 'list'"
        >Uebersicht</button>
        <button
          :class="['rt-btn', { active: calMode === 'week' }]"
          @click="calMode = 'week'"
        >Woche</button>
        <button
          :class="['rt-btn', { active: calMode === 'month' }]"
          @click="calMode = 'month'"
        >Monat</button>
        <button
          v-if="authStore.isLoggedIn"
          class="rt-btn"
          @click="openCreate"
        >+ Raid erstellen</button>
      </div>

      <!-- Size filter -->
      <div class="raid-filter-bar">
        <span class="rf-label">Groesse:</span>
        <button
          :class="['rf-btn', { active: sizeFilter === 'all' }]"
          @click="sizeFilter = 'all'"
        >Alle</button>
        <button
          :class="['rf-btn', { active: sizeFilter === '10' }]"
          @click="sizeFilter = '10'"
        >10er</button>
        <button
          :class="['rf-btn', { active: sizeFilter === '25' }]"
          @click="sizeFilter = '25'"
        >25er</button>
      </div>

      <!-- Auth hint -->
      <div v-if="!authStore.isLoggedIn" class="auth-hint">
        Melde dich an, um Raids zu erstellen oder dich anzumelden.
      </div>

      <!-- Kara signup section -->
      <div class="kara-section">
        <div class="kara-info-banner">
          <span class="kara-info-icon">⚔</span>
          <div>
            <strong>Karazhan Interesse?</strong>
            Melde dich hier fuer Karazhan an, damit die Raidleitung Gruppen planen kann.
            Waehle deinen Spec und bevorzugte Tage — die Gruppen werden auf der
            <router-link to="/kara" class="kara-link">Kara-Seite</router-link> zusammengestellt.
          </div>
        </div>
        <KaraSignupCard v-if="authStore.isLoggedIn && hasAnyEntry" />
        <div v-else-if="authStore.isLoggedIn && !hasAnyEntry" class="kara-no-entry">
          <router-link to="/form">Trage zuerst einen Charakter ein</router-link>, um dich fuer Karazhan anzumelden.
        </div>

        <!-- Signup overview list -->
        <div v-if="karaSignupsStore.signups.length > 0" class="kara-signups-overview">
          <button class="kara-signups-toggle" @click="showSignupList = !showSignupList">
            <span class="kso-summary">
              <strong>{{ karaSignupsStore.signups.length }} Angemeldet</strong>
              <span class="kso-roles">
                <span :style="{ color: ROLE_COLORS.Tank }">{{ karaSignupsStore.roleCounts.Tank }} Tank</span>
                <span :style="{ color: ROLE_COLORS.Heiler }">{{ karaSignupsStore.roleCounts.Heiler }} Heiler</span>
                <span :style="{ color: ROLE_COLORS.DPS }">{{ karaSignupsStore.roleCounts.DPS }} DPS</span>
              </span>
            </span>
            <span class="kso-chevron" :class="{ open: showSignupList }">&#9662;</span>
          </button>

          <div v-if="showSignupList" class="kara-signups-list">
            <div
              v-for="s in karaSignupsStore.signups"
              :key="s.entryId"
              class="kso-player"
            >
              <ClassIcon :class-name="s.className" size="sm" />
              <span class="kso-name" :style="{ color: cc(s.className) }">{{ s.charName }}</span>
              <span class="kso-specs">
                <span
                  v-for="role in signupRoles(s)"
                  :key="role"
                  class="kso-role"
                  :style="{ color: roleColor(role) }"
                >{{ role }}</span>
              </span>
              <span class="kso-days">
                <span v-for="d in s.days" :key="d" class="kso-day">{{ DAY_SHORT[d] }}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Calendar views -->
      <RaidCalendarWeek
        v-if="calMode === 'week'"
        :raids="filteredRaids"
        @select-raid="onCalSelectRaid"
      />
      <RaidCalendarMonth
        v-if="calMode === 'month'"
        :raids="filteredRaids"
        @select-raid="onCalSelectRaid"
      />

      <!-- List view -->
      <template v-if="calMode === 'list'">
        <div v-if="!filteredRaids.length" class="empty">
          Noch keine Raids geplant.
        </div>
        <template v-else>
          <div v-if="upcomingRaids.length">
            <div class="sec-l">Kommende Raids ({{ upcomingRaids.length }})</div>
            <div class="raid-list">
              <RaidCard
                v-for="r in upcomingRaids"
                :key="r.id"
                :raid="r"
                @click="goToRaid"
              />
            </div>
          </div>
          <div v-if="pastRaids.length">
            <div class="sec-l past-label">Vergangene Raids ({{ pastRaids.length }})</div>
            <div class="raid-list">
              <RaidCard
                v-for="r in pastRaids"
                :key="r.id"
                :raid="r"
                :is-past="true"
                @click="goToRaid"
              />
            </div>
          </div>
        </template>
      </template>
    </template>
  </div>
</template>

<style scoped>
#v-raids {
  max-width: 860px;
  margin: 0 auto;
}
.raid-tab-toggle {
  display: flex;
  gap: 6px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}
.rt-btn {
  padding: 8px 16px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background: none;
  color: var(--color-tx2);
  font: 13px var(--font-body);
  cursor: pointer;
  transition: all 0.15s;
}
.rt-btn:hover { background: rgba(255, 255, 255, 0.05); }
.rt-btn.active {
  background: rgba(201, 168, 76, 0.12);
  border-color: rgba(201, 168, 76, 0.3);
  color: var(--color-gold);
  font-weight: 600;
}
.raid-filter-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}
.rf-label {
  font-size: 12px;
  color: var(--color-tx3);
}
.rf-btn {
  padding: 4px 12px;
  border-radius: 4px;
  border: 1px solid var(--color-border);
  background: none;
  color: var(--color-tx3);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.rf-btn.active {
  background: rgba(201, 168, 76, 0.1);
  border-color: rgba(201, 168, 76, 0.25);
  color: var(--color-gold);
  font-weight: 600;
}
.auth-hint {
  text-align: center;
  font-size: 13px;
  color: var(--color-tx3);
  padding: 12px;
  margin-bottom: 14px;
  background: rgba(0, 0, 0, 0.15);
  border-radius: 8px;
}
.sec-l {
  font: 600 13px var(--font-heading);
  color: var(--color-tx2);
  margin-bottom: 10px;
}
.past-label {
  margin-top: 20px;
}
.raid-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.empty {
  text-align: center;
  padding: 40px 20px;
  color: var(--color-tx3);
  font-size: 14px;
}

/* Kara section */
.kara-section {
  margin-bottom: 18px;
}
.kara-info-banner {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 8px;
  background: rgba(201, 168, 76, 0.06);
  border: 1px solid rgba(201, 168, 76, 0.18);
  font-size: 13px;
  color: var(--color-tx2);
  line-height: 1.5;
  margin-bottom: 12px;
}
.kara-info-icon {
  font-size: 20px;
  flex-shrink: 0;
  margin-top: 1px;
}
.kara-info-banner strong {
  color: var(--color-gold);
}
.kara-link {
  color: var(--color-gold);
  font-weight: 600;
  text-decoration: underline;
}
.kara-no-entry {
  font-size: 13px;
  color: var(--color-tx3);
  padding: 10px 16px;
  background: rgba(0, 0, 0, 0.15);
  border-radius: 8px;
}
.kara-no-entry a {
  color: var(--color-gold);
  font-weight: 600;
  text-decoration: underline;
}

/* Signup overview */
.kara-signups-overview {
  margin-top: 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
}
.kara-signups-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: rgba(0, 0, 0, 0.15);
  border: none;
  cursor: pointer;
  font: 13px var(--font-body);
  color: var(--color-tx2);
  transition: background 0.15s;
}
.kara-signups-toggle:hover {
  background: rgba(0, 0, 0, 0.22);
}
.kso-summary {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.kso-summary strong {
  color: var(--color-gold);
}
.kso-roles {
  display: flex;
  gap: 10px;
  font-size: 12px;
}
.kso-chevron {
  font-size: 12px;
  color: var(--color-tx3);
  transition: transform 0.2s;
}
.kso-chevron.open {
  transform: rotate(180deg);
}

.kara-signups-list {
  padding: 6px 0;
}
.kso-player {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  font-size: 13px;
  transition: background 0.1s;
}
.kso-player:hover {
  background: rgba(255, 255, 255, 0.02);
}
.kso-name {
  font-weight: 600;
  min-width: 80px;
}
.kso-specs {
  display: flex;
  gap: 6px;
  font-size: 12px;
}
.kso-role {
  font-weight: 600;
}
.kso-days {
  display: flex;
  gap: 3px;
  margin-left: auto;
}
.kso-day {
  font-size: 11px;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 3px;
  background: rgba(201, 168, 76, 0.1);
  color: var(--color-gold);
}

@media (max-width: 767px) {
  .rt-btn {
    padding: 8px 12px;
    font-size: 12px;
    min-height: 36px;
  }

  .rf-btn {
    padding: 6px 12px;
    min-height: 32px;
  }
}
</style>
