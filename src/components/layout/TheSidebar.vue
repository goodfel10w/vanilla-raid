<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import TheAuthBar from './TheAuthBar.vue'

const route = useRoute()
const auth = useAuthStore()

interface NavItem {
  label: string
  route: string
  icon: string
  show: boolean
}

const navItems: NavItem[] = [
  { label: 'Dashboard', route: '/dashboard', icon: '\uD83D\uDCCA', show: true },
  { label: 'Neuigkeiten', route: '/news', icon: '\uD83D\uDCF0', show: true },
  { label: 'Mein Konto', route: '/form', icon: '\u270F\uFE0F', show: true },
  { label: 'Raids', route: '/raids', icon: '\u2694\uFE0F', show: true },
  { label: 'Aufstellung', route: '/roster', icon: '\uD83D\uDC65', show: true },
  { label: 'Heatmap', route: '/heatmap', icon: '\uD83D\uDCC5', show: true },
  { label: 'Auswertung', route: '/analytics', icon: '\uD83D\uDCC8', show: true },
  { label: 'DKP', route: '/dkp', icon: '\uD83D\uDCB0', show: true },
  { label: 'Kara Gruppen', route: '/kara', icon: '\uD83C\uDFF0', show: true },
]

function isActive(navRoute: string): boolean {
  return route.path === navRoute || route.path.startsWith(navRoute + '/')
}
</script>

<template>
  <nav class="sidebar">
    <div class="sidebar-header">
      <div class="guild-name">&lsaquo;Vanilla&rsaquo;</div>
      <div class="sidebar-title">Raid-Planer</div>
    </div>

    <div class="sidebar-nav">
      <router-link
        v-for="item in navItems"
        :key="item.route"
        :to="item.route"
        class="tab nav-item"
        :class="{ on: isActive(item.route) }"
        :data-v="item.route.slice(1)"
      >
        <span class="nav-icon">{{ item.icon }}</span>
        <span>{{ item.label }}</span>
      </router-link>

      <!-- Admin (conditional) -->
      <router-link
        v-if="auth.isAdmin"
        to="/admin"
        class="tab nav-item"
        :class="{ on: isActive('/admin') }"
        data-v="admin"
      >
        <span class="nav-icon">&#9881;&#65039;</span>
        <span>Admin</span>
      </router-link>
    </div>

    <TheAuthBar />
  </nav>
</template>

<style scoped>
.sidebar {
  background: rgba(10, 10, 18, 0.95);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  height: 100vh;
  position: sticky;
  top: 0;
  overflow-y: auto;
}

.sidebar-header {
  padding: 24px 20px 16px;
  text-align: center;
  border-bottom: 1px solid var(--color-border);
}

.guild-name {
  font-size: 11px;
  letter-spacing: 6px;
  text-transform: uppercase;
  color: var(--color-tx3);
  margin-bottom: 4px;
}

.sidebar-title {
  font-family: var(--font-heading);
  font-size: 20px;
  font-weight: 700;
  background: linear-gradient(135deg, var(--color-gold), var(--color-gold-light), var(--color-gold));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.sidebar-nav {
  flex: 1;
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border-radius: 8px;
  color: var(--color-tx2);
  text-decoration: none;
  font: 600 13px var(--font-body);
  letter-spacing: 0.3px;
  transition: all 0.15s;
  cursor: pointer;
  border: none;
  background: transparent;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.04);
  color: var(--color-tx);
}

.nav-item.on {
  background: linear-gradient(135deg, var(--color-gold), var(--color-gold-dark));
  color: var(--color-bg);
}

.nav-icon {
  font-size: 16px;
  width: 20px;
  text-align: center;
}
</style>
