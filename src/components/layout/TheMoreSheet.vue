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
</style>
