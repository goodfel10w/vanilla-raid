<script setup lang="ts">
import { type HTMLAttributes, useAttrs } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{
  class?: HTMLAttributes['class']
  modelValue?: string | number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const attrs = useAttrs()
</script>

<template>
  <input
    v-bind="attrs"
    :class="cn(
      'flex h-10 w-full rounded-lg border border-border bg-white/5 px-3 py-2 text-sm text-tx placeholder:text-tx4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:cursor-not-allowed disabled:opacity-50',
      props.class,
    )"
    :value="modelValue"
    @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
  />
</template>

<script lang="ts">
export default {
  inheritAttrs: false,
}
</script>
