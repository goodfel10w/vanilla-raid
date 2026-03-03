<script setup lang="ts">
import { TabsRoot, type TabsRootEmits, type TabsRootProps, useForwardPropsEmits } from 'radix-vue'

const props = defineProps<TabsRootProps>()
const emit = defineEmits<TabsRootEmits>()
const forwarded = useForwardPropsEmits(props, emit)
</script>

<template>
  <TabsRoot v-bind="forwarded">
    <slot />
  </TabsRoot>
</template>
