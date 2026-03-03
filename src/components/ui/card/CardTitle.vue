<script setup lang="ts">
import { type HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <h3 :class="cn('font-heading text-lg font-semibold leading-none tracking-tight text-gold', props.class)">
    <slot />
  </h3>
</template>
