<script setup lang="ts">
withDefaults(defineProps<{
  message?: string
  icon?: string
}>(), {
  message: 'Keine Daten vorhanden',
  icon: '\uD83D\uDCCB',
})
</script>

<template>
  <div class="empty">
    <div class="empty-icon">{{ icon }}</div>
    <div class="empty-msg">{{ message }}</div>
    <slot />
  </div>
</template>

<style scoped>
.empty {
  text-align: center;
  padding: 40px 20px;
  color: var(--color-tx3);
}

.empty-icon {
  font-size: 32px;
  margin-bottom: 12px;
}

.empty-msg {
  font-size: 14px;
  color: var(--color-tx4);
}
</style>
