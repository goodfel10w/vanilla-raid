<script setup lang="ts">
import { computed } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { useDkpStore } from '@/stores/dkp'
import { useEntriesStore } from '@/stores/entries'
import { useRouter } from 'vue-router'

const ui = useUiStore()
const auth = useAuthStore()
const dkp = useDkpStore()
const entries = useEntriesStore()
const router = useRouter()

const isOfficer = computed(() => {
  if (!auth.user) return false
  const uname = auth.user.username?.toLowerCase().split('#')[0]
  const roles = dkp.config.roles || {}
  return roles[uname] === 'admin' || roles[uname] === 'officer' || auth.isAdmin
})

const isAdmin = computed(() => {
  if (!auth.user) return false
  const uname = auth.user.username?.toLowerCase().split('#')[0]
  const roles = dkp.config.roles || {}
  return roles[uname] === 'admin' || auth.isAdmin
})

const myDkpPlayer = computed(() => {
  if (!auth.user) return null
  const uLower = auth.user.username?.toLowerCase() || ''
  const uPrefix = uLower.split('#')[0]
  let match = dkp.balances.find(b => {
    const lower = b.playerName.toLowerCase()
    return lower === uLower || lower === uPrefix
  })
  if (!match) {
    const myEntry = entries.entries.find(e => e.userId === auth.user!.userId)
    if (myEntry) match = dkp.balances.find(b => b.playerName === myEntry.charName)
  }
  return match
})

function setView(view: 'overview' | 'award' | 'spend' | 'decay' | 'settings') {
  ui.dkpView = view
  if (view === 'overview') ui.dkpPlayerDetail = null
}

function showMyDkp() {
  if (myDkpPlayer.value) {
    ui.dkpView = 'overview'
    ui.dkpTxFilter = 'all'
    router.push(`/dkp/player/${encodeURIComponent(myDkpPlayer.value.playerName)}`)
  }
}
</script>

<template>
  <div class="dkp-actions-bar">
    <button
      class="ht-btn"
      :class="{ active: ui.dkpView === 'overview' }"
      @click="setView('overview')"
    >Übersicht</button>
    <button
      v-if="auth.isLoggedIn && myDkpPlayer"
      class="ht-btn dkp-my-btn"
      @click="showMyDkp"
    >Mein DKP</button>
    <template v-if="isOfficer">
      <button
        class="ht-btn"
        :class="{ active: ui.dkpView === 'award' }"
        @click="setView('award')"
      >Vergeben</button>
      <button
        class="ht-btn"
        :class="{ active: ui.dkpView === 'spend' }"
        @click="setView('spend')"
      >Beute</button>
    </template>
    <template v-if="isAdmin">
      <button
        class="ht-btn"
        :class="{ active: ui.dkpView === 'decay' }"
        @click="setView('decay')"
      >Verfall</button>
      <button
        class="ht-btn"
        :class="{ active: ui.dkpView === 'settings' }"
        @click="setView('settings')"
      >Einstellungen</button>
    </template>
  </div>
</template>

<style scoped>
.dkp-actions-bar {
  display: flex;
  gap: 6px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.ht-btn {
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background: none;
  color: var(--color-tx2);
  cursor: pointer;
  font: 13px var(--font-body);
  transition: all 0.15s;
}

.ht-btn:hover {
  background: rgba(255, 255, 255, 0.05);
}

.ht-btn.active {
  background: rgba(201, 168, 76, 0.15);
  border-color: rgba(201, 168, 76, 0.35);
  color: var(--color-gold);
}

.dkp-my-btn {
  border-color: rgba(201, 168, 76, 0.25);
  color: var(--color-gold);
}
</style>
