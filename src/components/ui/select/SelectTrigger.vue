<script setup lang="ts">
import { type HTMLAttributes } from 'vue'
import { SelectIcon, SelectTrigger, type SelectTriggerProps } from 'radix-vue'
import { cn } from '@/lib/utils'

interface Props extends SelectTriggerProps {
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()
</script>

<template>
  <SelectTrigger
    v-bind="{ ...props, class: undefined }"
    :class="cn(
      'flex h-10 w-full items-center justify-between rounded-lg border border-border bg-white/5 px-3 py-2 text-sm text-tx placeholder:text-tx4 focus:outline-none focus:ring-2 focus:ring-gold disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1',
      props.class,
    )"
  >
    <slot />
    <SelectIcon as-child>
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="opacity-50"><path d="m6 9 6 6 6-6"/></svg>
    </SelectIcon>
  </SelectTrigger>
</template>
