<script setup lang="ts">
import { type HTMLAttributes } from 'vue'
import {
  DialogContent,
  type DialogContentEmits,
  type DialogContentProps,
  DialogOverlay,
  DialogPortal,
  useForwardPropsEmits,
} from 'radix-vue'
import { cn } from '@/lib/utils'

interface Props extends DialogContentProps {
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()
const emit = defineEmits<DialogContentEmits>()
const forwarded = useForwardPropsEmits(props, emit)
</script>

<template>
  <DialogPortal>
    <DialogOverlay
      class="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
    />
    <DialogContent
      v-bind="{ ...forwarded, class: undefined }"
      :class="cn(
        'fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-bg2 p-6 shadow-lg',
        props.class,
      )"
    >
      <slot />
    </DialogContent>
  </DialogPortal>
</template>
