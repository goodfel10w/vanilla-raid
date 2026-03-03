<script setup lang="ts">
import { type HTMLAttributes } from 'vue'
import {
  CheckboxIndicator,
  CheckboxRoot,
  type CheckboxRootEmits,
  type CheckboxRootProps,
  useForwardPropsEmits,
} from 'radix-vue'
import { cn } from '@/lib/utils'

interface Props extends CheckboxRootProps {
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()
const emit = defineEmits<CheckboxRootEmits>()
const forwarded = useForwardPropsEmits(props, emit)
</script>

<template>
  <CheckboxRoot
    v-bind="{ ...forwarded, class: undefined }"
    :class="cn(
      'peer h-4 w-4 shrink-0 rounded border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-gold data-[state=checked]:text-bg data-[state=checked]:border-gold',
      props.class,
    )"
  >
    <CheckboxIndicator class="flex items-center justify-center text-current">
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
    </CheckboxIndicator>
  </CheckboxRoot>
</template>
