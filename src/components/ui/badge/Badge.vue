<script setup lang="ts">
import { type HTMLAttributes } from 'vue'
import { type VariantProps, cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-gold/20 text-gold border border-gold/30',
        secondary: 'bg-white/5 text-tx2 border border-border',
        destructive: 'bg-dps/20 text-dps border border-dps/30',
        success: 'bg-green-bg text-green border border-green-border',
        warning: 'bg-yellow-bg text-yellow border border-yellow-border',
        tank: 'bg-tank/20 text-tank border border-tank/30',
        healer: 'bg-heal/20 text-heal border border-heal/30',
        dps: 'bg-dps/20 text-dps border border-dps/30',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export type BadgeVariants = VariantProps<typeof badgeVariants>

const props = defineProps<{
  variant?: BadgeVariants['variant']
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <span :class="cn(badgeVariants({ variant }), props.class)">
    <slot />
  </span>
</template>
