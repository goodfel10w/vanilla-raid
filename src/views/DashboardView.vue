<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useEntriesStore } from '@/stores/entries'
import { useRaidsStore } from '@/stores/raids'
import { useNewsStore } from '@/stores/news'
import { useKaraSignupsStore } from '@/stores/karaSignups'
import { useDashboardData } from '@/composables/useDashboardData'
import { ROLES, ROLE_COLORS, ROLE_ICONS } from '@/lib/constants'
import type { RoleName } from '@/lib/constants'
import MyRaidsCard from '@/components/dashboard/MyRaidsCard.vue'
import NotificationsCard from '@/components/dashboard/NotificationsCard.vue'
import SuggestedRaidsCard from '@/components/dashboard/SuggestedRaidsCard.vue'
import LatestNewsCard from '@/components/dashboard/LatestNewsCard.vue'
import KaraSignupCard from '@/components/dashboard/KaraSignupCard.vue'

const authStore = useAuthStore()
const entriesStore = useEntriesStore()
const raidsStore = useRaidsStore()
const newsStore = useNewsStore()
const karaSignupsStore = useKaraSignupsStore()

const { myRaidsThisWeek, notifications, suggestedRaids, updateSnapshot } = useDashboardData()

const hasAnyEntry = computed(() => {
  if (!authStore.user) return false
  return entriesStore.entries.some(e => e.userId === authStore.user!.userId)
})

onMounted(async () => {
  const promises: Promise<void>[] = []
  if (!entriesStore.entries.length) promises.push(entriesStore.load())
  if (!raidsStore.raids.length) promises.push(raidsStore.load())
  if (!newsStore.posts.length) promises.push(newsStore.load())
  await Promise.all(promises)
  if (authStore.isLoggedIn) {
    updateSnapshot()
    karaSignupsStore.load(0)
  }
})

const entryCount = computed(() => entriesStore.entries.length)

const roleCounts = computed(() => {
  return ROLES.map(r => ({
    role: r,
    count: entriesStore.entries.filter(e => (e.roles || []).includes(r)).length,
    pct: entriesStore.entries.length
      ? Math.round(
          (entriesStore.entries.filter(e => (e.roles || []).includes(r)).length /
            entriesStore.entries.length) *
            100
        )
      : 0,
  }))
})

function roleColor(role: RoleName): string {
  return ROLE_COLORS[role]
}

function roleIcon(role: RoleName): string {
  return ROLE_ICONS[role]
}

const dashboardPosts = computed(() => newsStore.posts.slice(0, 3))
</script>

<template>
  <div id="v-dashboard">
    <!-- Quick Actions -->
    <div class="quick-actions">
      <router-link to="/form" class="qa-link">
        Mein Profil
      </router-link>
      <router-link to="/raids" class="qa-link">
        Raids
      </router-link>
      <router-link to="/dkp" class="qa-link">
        DKP
      </router-link>
    </div>

    <!-- Latest News -->
    <LatestNewsCard :posts="dashboardPosts" />

    <!-- Personalized sections for logged-in users -->
    <template v-if="authStore.isLoggedIn">
      <NotificationsCard v-if="notifications.length" :notifications="notifications" />
      <MyRaidsCard :raids="myRaidsThisWeek" />
      <SuggestedRaidsCard v-if="suggestedRaids.length" :raids="suggestedRaids" />
      <KaraSignupCard v-if="hasAnyEntry" />
    </template>

    <!-- Upcoming Raids - visible to all users -->
    <UpcomingRaidsCard :raids="raidsStore.upcomingRaids" />

    <template v-if="entryCount > 0">
      <!-- Role Distribution -->
      <div class="card dash-card">
        <div class="card-t">Rollenverteilung</div>
        <div class="role-an">
          <div v-for="rc in roleCounts" :key="rc.role" class="role-an-item">
            <div class="big" :style="{ color: roleColor(rc.role) }">{{ rc.count }}</div>
            <div class="sm">{{ roleIcon(rc.role) }} {{ rc.role }}</div>
            <div class="rprog">
              <div
                class="rprog-f"
                :style="{ width: rc.pct + '%', background: roleColor(rc.role) }"
              ></div>
            </div>
            <div class="pct-label">{{ rc.pct }}%</div>
          </div>
        </div>
      </div>

    </template>

    <div v-else class="empty">
      Noch keine Eintr&auml;ge vorhanden.
    </div>
  </div>
</template>

<style scoped>
.quick-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.qa-link {
  padding: 10px 24px;
  border-radius: 8px;
  font: 600 13px var(--font-body);
  background: rgba(201, 168, 76, 0.08);
  border: 1px solid rgba(201, 168, 76, 0.2);
  color: var(--color-gold);
  text-decoration: none;
  transition: all 0.15s;
}

.qa-link:hover {
  background: rgba(201, 168, 76, 0.15);
  border-color: rgba(201, 168, 76, 0.35);
}

.card {
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 20px;
}

.dash-card {
  margin-bottom: 16px;
}

.card-t {
  font: 600 15px var(--font-heading);
  color: var(--color-gold);
  margin-bottom: 16px;
}

.role-an {
  display: flex;
  gap: 16px;
  justify-content: center;
  flex-wrap: wrap;
}

.role-an-item {
  text-align: center;
  min-width: 100px;
}

.role-an-item .big {
  font-size: 28px;
  font-weight: 700;
}

.role-an-item .sm {
  font-size: 12px;
  color: var(--color-tx3);
}

.rprog {
  height: 4px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 2px;
  margin-top: 6px;
  overflow: hidden;
}

.rprog-f {
  height: 100%;
  border-radius: 2px;
  transition: width 0.5s;
}

.pct-label {
  font-size: 10px;
  color: var(--color-tx4);
  margin-top: 3px;
}

.empty {
  text-align: center;
  padding: 40px 20px;
  color: var(--color-tx3);
  font-size: 14px;
}
</style>
