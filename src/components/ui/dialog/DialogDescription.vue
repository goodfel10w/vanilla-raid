<script setup lang="ts">
import { type HTMLAttributes } from 'vue'
import { DialogDescription, type DialogDescriptionProps } from 'radix-vue'
import { cn } from '@/lib/utils'

interface Props extends DialogDescriptionProps {
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()
</script>

<template>
  <DialogDescription :class="cn('text-sm text-tx3', props.class)">
    <slot />
  </DialogDescription>
</template>
