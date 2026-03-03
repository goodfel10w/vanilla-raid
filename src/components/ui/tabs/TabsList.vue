<script setup lang="ts">
import { type HTMLAttributes } from 'vue'
import { TabsList, type TabsListProps } from 'radix-vue'
import { cn } from '@/lib/utils'

interface Props extends TabsListProps {
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()
</script>

<template>
  <TabsList
    v-bind="{ ...props, class: undefined }"
    :class="cn(
      'inline-flex h-10 items-center justify-center rounded-lg bg-white/5 p-1 text-tx3',
      props.class,
    )"
  >
    <slot />
  </TabsList>
</template>
