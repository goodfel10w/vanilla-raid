<script setup lang="ts">
import { cc } from '@/lib/utils'
import ClassIcon from './ClassIcon.vue'

const props = defineProps<{
  name: string
  className: string
  showIcon?: boolean
}>()
</script>

<template>
  <span class="player-chip" :style="{ color: cc(className) }">
    <ClassIcon v-if="showIcon" :class-name="className" size="sm" />
    {{ name }}
  </span>
</template>

<style scoped>
.player-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
  font-size: 13px;
}
</style>
