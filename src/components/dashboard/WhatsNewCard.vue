<script setup lang="ts">
import type { WhatsNewFeature } from '@/lib/whatsNewFeatures'

defineProps<{
  features: WhatsNewFeature[]
}>()

const emit = defineEmits<{
  dismiss: [featureId: string]
  dismissAll: []
}>()
</script>

<template>
  <div class="card dash-card wn-card">
    <div class="wn-header">
      <div class="card-t">Was gibt's Neues?</div>
      <button
        v-if="features.length > 1"
        class="wn-dismiss-all"
        @click="emit('dismissAll')"
      >
        Alle gelesen
      </button>
    </div>
    <div
      v-for="feature in features"
      :key="feature.id"
      class="wn-item"
    >
      <div class="wn-icon">{{ feature.icon }}</div>
      <div class="wn-body">
        <div class="wn-title">{{ feature.title }}</div>
        <div class="wn-desc">{{ feature.description }}</div>
        <router-link
          v-if="feature.route"
          :to="feature.route"
          class="wn-link"
        >
          {{ feature.routeLabel || 'Mehr erfahren' }} &rarr;
        </router-link>
      </div>
      <button
        class="wn-close"
        aria-label="Schließen"
        @click="emit('dismiss', feature.id)"
      >
        ✕
      </button>
    </div>
  </div>
</template>

<style scoped>
.card {
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 20px;
}
.dash-card { margin-bottom: 16px; }
.card-t {
  font: 600 15px var(--font-heading);
  color: var(--color-gold);
  margin-bottom: 0;
}

.wn-card {
  border-color: rgba(201, 168, 76, 0.2);
}

.wn-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.wn-dismiss-all {
  font: 600 11px var(--font-body);
  color: var(--color-tx4);
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: color 0.15s;
}
.wn-dismiss-all:hover {
  color: var(--color-gold);
}

.wn-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  background: rgba(201, 168, 76, 0.04);
  border-left: 3px solid var(--color-gold);
  margin-bottom: 8px;
}
.wn-item:last-child { margin-bottom: 0; }

.wn-icon {
  font-size: 20px;
  flex-shrink: 0;
  line-height: 1.4;
}

.wn-body {
  flex: 1;
  min-width: 0;
}

.wn-title {
  font: 600 14px var(--font-heading);
  color: var(--color-gold-light);
  margin-bottom: 4px;
}

.wn-desc {
  font-size: 13px;
  line-height: 1.45;
  color: var(--color-tx2);
}

.wn-link {
  display: inline-block;
  margin-top: 8px;
  font: 600 12px var(--font-body);
  color: var(--color-gold);
  text-decoration: none;
  padding: 4px 12px;
  border-radius: 6px;
  background: rgba(201, 168, 76, 0.08);
  border: 1px solid rgba(201, 168, 76, 0.2);
  transition: all 0.15s;
}
.wn-link:hover {
  background: rgba(201, 168, 76, 0.15);
  border-color: rgba(201, 168, 76, 0.35);
}

.wn-close {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--color-tx4);
  background: none;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}
.wn-close:hover {
  color: var(--color-tx);
  background: rgba(255, 255, 255, 0.05);
}
</style>
