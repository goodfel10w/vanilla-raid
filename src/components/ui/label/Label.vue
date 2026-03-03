<script setup lang="ts">
import { type HTMLAttributes } from 'vue'
import { Label as LabelPrimitive } from 'radix-vue'
import { cn } from '@/lib/utils'

const props = defineProps<{
  class?: HTMLAttributes['class']
  for?: string
}>()
</script>

<template>
  <LabelPrimitive
    :for="props.for"
    :class="cn('text-sm font-medium leading-none text-tx2 peer-disabled:cursor-not-allowed peer-disabled:opacity-70', props.class)"
  >
    <slot />
  </LabelPrimitive>
</template>
