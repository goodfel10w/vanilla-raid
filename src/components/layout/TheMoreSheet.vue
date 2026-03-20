<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const emit = defineEmits<{ close: [] }>()
const route = useRoute()
const auth = useAuthStore()

const moreItems = [
  { label: 'Aufstellung', route: '/roster', icon: '\uD83D\uDC65' },
  { label: 'Heatmap', route: '/heatmap', icon: '\uD83D\uDCC5' },
  { label: 'Auswertung', route: '/analytics', icon: '\uD83D\uDCC8' },
  { label: 'Kara Gruppen', route: '/kara', icon: '\uD83C\uDFF0' },
]

function navigate() {
  emit('close')
}

async function handleLogin() {
  emit('close')
  await auth.bnetLogin()
}

async function handleLogout() {
  emit('close')
  await auth.logout()
}
</script>

<template>
  <div class="more-overlay" @click.self="emit('close')">
    <div class="more-sheet">
      <div class="more-header">
        <span>Mehr</span>
        <button class="more-close" @click="emit('close')">&#10005;</button>
      </div>
      <router-link
        v-for="item in moreItems"
        :key="item.route"
        :to="item.route"
        class="more-sheet-item tab"
        :class="{ on: route.path === item.route }"
        @click="navigate()"
      >
        <span class="more-icon">{{ item.icon }}</span>
        <span>{{ item.label }}</span>
      </router-link>
      <router-link
        v-if="auth.isAdmin"
        to="/admin"
        class="more-sheet-item tab"
        :class="{ on: route.path === '/admin' }"
        @click="navigate()"
      >
        <span class="more-icon">&#9881;&#65039;</span>
        <span>Admin</span>
      </router-link>

      <!-- Auth section -->
      <div class="more-auth">
        <template v-if="auth.isLoggedIn">
          <div class="more-auth-user">
            <span class="auth-user">{{ auth.user?.username }}</span>
            <span v-if="auth.isAdmin" class="auth-role-badge">Admin</span>
          </div>
          <button class="btn-logout" data-action="logout" @click="handleLogout">
            Abmelden
          </button>
        </template>
        <template v-else>
          <button class="btn-bnet" @click="handleLogin">
            Mit Battle.net anmelden
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.more-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 200;
  display: flex;
  align-items: flex-end;
}

.more-sheet {
  width: 100%;
  background: #1a1828;
  border-top: 1px solid var(--color-border);
  border-radius: 16px 16px 0 0;
  padding: 16px;
  padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  animation: slideUp 0.2s ease;
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.more-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 12px;
  margin-bottom: 8px;
  border-bottom: 1px solid var(--color-border);
  font: 600 14px var(--font-body);
  color: var(--color-tx2);
}

.more-close {
  background: none;
  border: none;
  color: var(--color-tx3);
  font-size: 18px;
  cursor: pointer;
  padding: 4px;
}

.more-sheet-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  color: var(--color-tx2);
  text-decoration: none;
  font: 600 14px var(--font-body);
  transition: all 0.15s;
}

.more-sheet-item:hover,
.more-sheet-item.on {
  background: rgba(255, 255, 255, 0.04);
  color: var(--color-gold);
}

.more-icon {
  font-size: 18px;
  width: 24px;
  text-align: center;
}

.more-auth {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--color-border);
}

.more-auth-user {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  margin-bottom: 8px;
}

.auth-user {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-tx);
}

.auth-role-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: rgba(201, 168, 76, 0.2);
  color: var(--color-gold);
  border: 1px solid rgba(201, 168, 76, 0.3);
}

.btn-bnet {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  padding: 12px;
  background: #0074e0;
  color: white;
  border: none;
  border-radius: 8px;
  font: 600 13px var(--font-body);
  cursor: pointer;
  min-height: 44px;
}

.btn-logout {
  display: block;
  width: 100%;
  padding: 10px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-tx3);
  font: 13px var(--font-body);
  cursor: pointer;
  min-height: 44px;
}
</style>
