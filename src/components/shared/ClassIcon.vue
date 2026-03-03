<script setup lang="ts">
import { computed } from 'vue'
import { CLS, WOW_ICONS } from '@/lib/constants'

const props = withDefaults(defineProps<{
  className: string
  size?: 'sm' | 'md' | 'lg'
}>(), {
  size: 'md',
})

const iconSrc = computed(() => {
  const cls = CLS.find(c => c.name === props.className)
  return cls ? `${WOW_ICONS}/class/64/${cls.icon}.png` : ''
})

const sizeClass = computed(() => {
  return props.size === 'sm' ? 'wow-ico-sm' : props.size === 'lg' ? 'wow-ico-lg' : 'wow-ico'
})
</script>

<template>
  <img v-if="iconSrc" :class="sizeClass" :src="iconSrc" :alt="className" loading="lazy" />
</template>

<style scoped>
.wow-ico { width: 20px; height: 20px; border-radius: 4px; vertical-align: middle; }
.wow-ico-sm { width: 16px; height: 16px; border-radius: 3px; vertical-align: middle; }
.wow-ico-lg { width: 28px; height: 28px; border-radius: 5px; vertical-align: middle; }
</style>
