<script setup lang="ts">
import { computed } from 'vue'
import { useEntriesStore } from '@/stores/entries'

const entries = useEntriesStore()

const counterText = computed(() => {
  return `${entries.entries.length} Raider eingetragen`
})
</script>

<template>
  <header class="app-header">
    <div class="guild">&lsaquo;Vanilla&rsaquo;</div>
    <h1>Raid-Planer &mdash; TBC</h1>
    <div class="cnt" id="counter">{{ counterText }}</div>
  </header>
</template>

<style scoped>
.app-header {
  text-align: center;
  margin-bottom: 28px;
}

.guild {
  font-size: 11px;
  letter-spacing: 6px;
  text-transform: uppercase;
  color: #7a6f8a;
  margin-bottom: 4px;
}

h1 {
  font-family: var(--font-heading);
  font-size: 34px;
  font-weight: 700;
  background: linear-gradient(135deg, var(--color-gold), var(--color-gold-light), var(--color-gold));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  letter-spacing: 1px;
}

.cnt {
  color: var(--color-tx3);
  font-size: 13px;
  margin-top: 6px;
  transition: opacity 0.3s;
}

@media (min-width: 768px) {
  .guild {
    display: none;
  }
}
</style>
