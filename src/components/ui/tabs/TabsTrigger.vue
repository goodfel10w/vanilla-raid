<script setup lang="ts">
import { type HTMLAttributes } from 'vue'
import { TabsTrigger, type TabsTriggerProps } from 'radix-vue'
import { cn } from '@/lib/utils'

interface Props extends TabsTriggerProps {
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()
</script>

<template>
  <TabsTrigger
    v-bind="{ ...props, class: undefined }"
    :class="cn(
      'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-gold/20 data-[state=active]:text-gold data-[state=active]:shadow-sm',
      props.class,
    )"
  >
    <slot />
  </TabsTrigger>
</template>
