<script setup lang="ts">
import { ROLE_COLORS, ROLE_ICONS } from '@/lib/constants'
import type { RoleName } from '@/lib/constants'

const props = defineProps<{
  role: RoleName
  showIcon?: boolean
}>()
</script>

<template>
  <span
    class="rbadge"
    :style="{ color: ROLE_COLORS[role], background: ROLE_COLORS[role] + '18' }"
  >
    <span v-if="showIcon">{{ ROLE_ICONS[role] }}</span>
    {{ role }}
  </span>
</template>

<style scoped>
.rbadge {
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 4px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
</style>
