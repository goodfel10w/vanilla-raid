<script setup lang="ts">
import { type HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <tr :class="cn('border-b border-border transition-colors hover:bg-white/[0.02] data-[state=selected]:bg-white/5', props.class)">
    <slot />
  </tr>
</template>
