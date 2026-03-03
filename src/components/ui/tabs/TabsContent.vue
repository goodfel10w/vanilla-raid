<script setup lang="ts">
import { type HTMLAttributes } from 'vue'
import { TabsContent, type TabsContentProps } from 'radix-vue'
import { cn } from '@/lib/utils'

interface Props extends TabsContentProps {
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()
</script>

<template>
  <TabsContent
    v-bind="{ ...props, class: undefined }"
    :class="cn(
      'mt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold',
      props.class,
    )"
  >
    <slot />
  </TabsContent>
</template>
