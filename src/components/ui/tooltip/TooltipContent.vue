<script setup lang="ts">
import { type HTMLAttributes } from 'vue'
import { TooltipContent, type TooltipContentEmits, type TooltipContentProps, TooltipPortal, useForwardPropsEmits } from 'radix-vue'
import { cn } from '@/lib/utils'

interface Props extends TooltipContentProps {
  class?: HTMLAttributes['class']
}

const props = withDefaults(defineProps<Props>(), {
  sideOffset: 4,
})
const emit = defineEmits<TooltipContentEmits>()
const forwarded = useForwardPropsEmits(props, emit)
</script>

<template>
  <TooltipPortal>
    <TooltipContent
      v-bind="{ ...forwarded, class: undefined }"
      :class="cn(
        'z-50 overflow-hidden rounded-md border border-border bg-bg2 px-3 py-1.5 text-sm text-tx shadow-md',
        props.class,
      )"
    >
      <slot />
    </TooltipContent>
  </TooltipPortal>
</template>
