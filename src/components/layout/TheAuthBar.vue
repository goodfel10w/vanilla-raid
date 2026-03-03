<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()

const BNET_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="vertical-align:middle;margin-right:4px"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>`

async function handleLogin() {
  await auth.bnetLogin()
}

async function handleLogout() {
  await auth.logout()
}
</script>

<template>
  <div id="auth-bar" class="auth-bar">
    <template v-if="auth.isLoggedIn">
      <div class="auth-user">
        <span class="auth-username">{{ auth.user?.username }}</span>
        <span v-if="auth.isAdmin" class="auth-role-badge admin">Admin</span>
      </div>
      <div v-if="auth.user?.discordLinked" class="discord-status">
        <span class="discord-icon">&#127918;</span>
        <span class="discord-name">{{ auth.user?.discordUsername || 'Discord' }}</span>
      </div>
      <button
        class="btn-logout"
        data-action="logout"
        @click="handleLogout"
      >
        Abmelden
      </button>
    </template>
    <template v-else>
      <button class="btn-bnet" @click="handleLogin">
        <span v-html="BNET_ICON"></span>
        Mit Battle.net anmelden
      </button>
    </template>
  </div>
</template>

<style scoped>
.auth-bar {
  padding: 16px;
  border-top: 1px solid var(--color-border);
  margin-top: auto;
}

.auth-user {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.auth-username {
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
}

.auth-role-badge.admin {
  background: rgba(201, 168, 76, 0.2);
  color: var(--color-gold);
  border: 1px solid rgba(201, 168, 76, 0.3);
}

.discord-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--color-tx3);
  margin-bottom: 8px;
}

.btn-bnet {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  padding: 10px;
  background: #0074e0;
  color: white;
  border: none;
  border-radius: 8px;
  font: 600 13px var(--font-body);
  cursor: pointer;
  transition: background 0.2s;
}

.btn-bnet:hover {
  background: #005bb5;
}

.btn-logout {
  display: block;
  width: 100%;
  padding: 8px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-tx3);
  font: 13px var(--font-body);
  cursor: pointer;
  transition: all 0.15s;
}

.btn-logout:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--color-tx);
}
</style>
