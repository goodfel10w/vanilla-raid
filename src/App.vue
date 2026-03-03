<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useEntriesStore } from '@/stores/entries'
import { useRaidsStore } from '@/stores/raids'
import { useDkpStore } from '@/stores/dkp'
import { useToast } from '@/composables/useToast'
import TheSidebar from '@/components/layout/TheSidebar.vue'
import TheBottomNav from '@/components/layout/TheBottomNav.vue'
import TheHeader from '@/components/layout/TheHeader.vue'
import AppToast from '@/components/shared/AppToast.vue'

const auth = useAuthStore()
const entries = useEntriesStore()
const raids = useRaidsStore()
const dkp = useDkpStore()
const { toast } = useToast()

onMounted(async () => {
  // Handle OAuth callback parameters
  const queryParams = new URLSearchParams(window.location.search)
  const bnetToken = queryParams.get('bnet_token')
  const authError = queryParams.get('auth_error')

  if (bnetToken) {
    window.history.replaceState({}, '', window.location.pathname + window.location.hash)
    auth.saveSession({ token: bnetToken, username: '...', userId: '' })
    try {
      await auth.validate()
      if (auth.user?.username && auth.user.username !== '...') {
        toast('Angemeldet als ' + auth.user.username)
      }
    } catch {
      auth.clearSession()
      toast('Anmeldung fehlgeschlagen')
    }
  } else if (authError) {
    window.history.replaceState({}, '', window.location.pathname + window.location.hash)
    toast('Battle.net-Anmeldung fehlgeschlagen')
  } else {
    await auth.validate()
  }

  await Promise.all([entries.load(), raids.load(), dkp.load()])
})
</script>

<template>
  <div class="app-shell">
    <!-- Decorative glow backgrounds -->
    <div class="glow g1"></div>
    <div class="glow g2"></div>

    <!-- Sidebar (desktop) -->
    <TheSidebar class="sidebar-area" />

    <!-- Main content area -->
    <main class="main-area">
      <TheHeader />
      <router-view v-slot="{ Component }">
        <component :is="Component" />
      </router-view>
    </main>

    <!-- Bottom nav (mobile) -->
    <TheBottomNav class="bottom-nav-area" />

    <!-- Toast notifications -->
    <AppToast />
  </div>
</template>

<style scoped>
.app-shell {
  display: grid;
  grid-template-columns: 240px 1fr;
  grid-template-rows: 1fr auto;
  min-height: 100vh;
  position: relative;
}

.sidebar-area {
  grid-column: 1;
  grid-row: 1 / -1;
}

.main-area {
  grid-column: 2;
  grid-row: 1;
  padding: 32px 20px;
  max-width: 960px;
  width: 100%;
  margin: 0 auto;
  position: relative;
  z-index: 1;
}

.bottom-nav-area {
  display: none;
}

.glow {
  position: fixed;
  pointer-events: none;
}

.g1 {
  top: -30%;
  left: -10%;
  width: 50%;
  height: 60%;
  background: radial-gradient(ellipse, rgba(80, 40, 120, .08), transparent 70%);
}

.g2 {
  bottom: -20%;
  right: -10%;
  width: 40%;
  height: 50%;
  background: radial-gradient(ellipse, rgba(40, 60, 120, .06), transparent 70%);
}

@media (max-width: 767px) {
  .app-shell {
    grid-template-columns: 1fr;
  }

  .sidebar-area {
    display: none;
  }

  .bottom-nav-area {
    display: block;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 100;
  }

  .main-area {
    padding: 20px 16px 80px 16px;
  }
}
</style>
