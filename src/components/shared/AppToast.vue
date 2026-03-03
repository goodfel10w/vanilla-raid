<script setup lang="ts">
import { useToast } from '@/composables/useToast'

const { message, visible } = useToast()
</script>

<template>
  <div id="toast" :class="{ show: visible }">{{ message }}</div>
</template>

<style scoped>
#toast {
  position: fixed;
  bottom: 32px;
  left: 50%;
  transform: translateX(-50%) translateY(20px);
  background: #1a1828;
  color: var(--color-tx);
  padding: 12px 24px;
  border-radius: 8px;
  border: 1px solid var(--color-gold-dark);
  font: 600 13px var(--font-body);
  opacity: 0;
  pointer-events: none;
  transition: all 0.3s;
  z-index: 1000;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}

#toast.show {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}
</style>
