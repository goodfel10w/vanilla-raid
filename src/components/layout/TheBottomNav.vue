<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import TheMoreSheet from './TheMoreSheet.vue'

const route = useRoute()
const showMore = ref(false)

interface BottomNavItem {
  label: string
  route: string
  icon: string
}

const mainItems: BottomNavItem[] = [
  { label: 'Dashboard', route: '/dashboard', icon: '\uD83D\uDCCA' },
  { label: 'Eintragen', route: '/form', icon: '\u270F\uFE0F' },
  { label: 'Raids', route: '/raids', icon: '\u2694\uFE0F' },
  { label: 'DKP', route: '/dkp', icon: '\uD83D\uDCB0' },
]

function isActive(navRoute: string): boolean {
  return route.path === navRoute || route.path.startsWith(navRoute + '/')
}

const moreActive = computed(() =>
  ['/roster', '/heatmap', '/analytics', '/kara', '/admin']
    .some(r => route.path === r || route.path.startsWith(r + '/'))
)
</script>

<template>
  <nav class="bottom-nav">
    <router-link
      v-for="item in mainItems"
      :key="item.route"
      :to="item.route"
      class="tab bottom-nav-item"
      :class="{ on: isActive(item.route) }"
    >
      <span class="bnav-icon">{{ item.icon }}</span>
      <span class="bnav-label">{{ item.label }}</span>
    </router-link>

    <button
      class="tab bottom-nav-item"
      :class="{ on: moreActive }"
      @click="showMore = !showMore"
    >
      <span class="bnav-icon">&#9776;</span>
      <span class="bnav-label">Mehr</span>
    </button>

    <TheMoreSheet v-if="showMore" @close="showMore = false" />
  </nav>
</template>

<style scoped>
.bottom-nav {
  display: flex;
  justify-content: space-around;
  align-items: center;
  background: rgba(10, 10, 18, 0.98);
  border-top: 1px solid var(--color-border);
  padding: 6px 0;
  padding-bottom: env(safe-area-inset-bottom, 6px);
}

.bottom-nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 12px;
  border: none;
  background: none;
  color: var(--color-tx3);
  text-decoration: none;
  cursor: pointer;
  font-family: var(--font-body);
  border-radius: 8px;
  transition: all 0.15s;
  min-width: 56px;
}

.bottom-nav-item.on {
  color: var(--color-gold);
}

.bnav-icon {
  font-size: 18px;
}

.bnav-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.3px;
}
</style>
