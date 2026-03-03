<script setup lang="ts">
import { type HTMLAttributes } from 'vue'
import {
  SelectContent,
  type SelectContentEmits,
  type SelectContentProps,
  SelectPortal,
  SelectViewport,
  useForwardPropsEmits,
} from 'radix-vue'
import { cn } from '@/lib/utils'

interface Props extends SelectContentProps {
  class?: HTMLAttributes['class']
}

const props = withDefaults(defineProps<Props>(), {
  position: 'popper',
  sideOffset: 4,
})
const emit = defineEmits<SelectContentEmits>()
const forwarded = useForwardPropsEmits(props, emit)
</script>

<template>
  <SelectPortal>
    <SelectContent
      v-bind="{ ...forwarded, class: undefined }"
      :class="cn(
        'relative z-50 max-h-96 min-w-32 overflow-hidden rounded-lg border border-border bg-bg2 shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
        position === 'popper' && 'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
        props.class,
      )"
    >
      <SelectViewport
        :class="cn('p-1', position === 'popper' && 'h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]')"
      >
        <slot />
      </SelectViewport>
    </SelectContent>
  </SelectPortal>
</template>
