<script setup lang="ts">
import { computed } from 'vue'
import { CLASS_SPECS, ROLE_COLORS, WOW_ICONS } from '@/lib/constants'
import type { RoleName } from '@/lib/constants'

const props = defineProps<{
  className: string
  modelValue: string[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const specs = computed(() => CLASS_SPECS[props.className] || [])

function toggleSpec(name: string) {
  const current = [...props.modelValue]
  const idx = current.indexOf(name)
  if (idx >= 0) {
    current.splice(idx, 1)
  } else {
    current.push(name)
  }
  emit('update:modelValue', current)
}

function getColor(role: RoleName): string {
  return ROLE_COLORS[role]
}
</script>

<template>
  <div v-if="specs.length > 0" class="rchips" role="group" aria-label="Specs">
    <div
      v-for="spec in specs"
      :key="spec.name"
      class="rchip"
      :class="{ active: modelValue.includes(spec.name) }"
      role="checkbox"
      :aria-checked="modelValue.includes(spec.name) ? 'true' : 'false'"
      :style="modelValue.includes(spec.name) ? {
        borderColor: getColor(spec.role),
        color: getColor(spec.role),
        background: getColor(spec.role) + '18'
      } : {}"
      tabindex="0"
      @click="toggleSpec(spec.name)"
      @keydown.space.prevent="toggleSpec(spec.name)"
      @keydown.enter.prevent="toggleSpec(spec.name)"
    >
      <img
        class="wow-ico"
        :src="`${WOW_ICONS}/spec/${spec.icon}.png`"
        :alt="spec.name"
        loading="lazy"
      />
      {{ spec.name }}
      <span class="spec-role">{{ spec.role }}</span>
    </div>
  </div>
  <div v-else class="no-specs">
    Wähle zuerst eine Klasse
  </div>
</template>

<style scoped>
.rchips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.rchip {
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  font: 600 13px var(--font-body);
  border: 2px solid var(--color-border);
  background: rgba(0, 0, 0, 0.2);
  color: var(--color-tx3);
  transition: all 0.15s;
  user-select: none;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.rchip:hover {
  border-color: rgba(255, 255, 255, 0.12);
}

.wow-ico {
  width: 20px;
  height: 20px;
  border-radius: 4px;
}

.spec-role {
  font-size: 10px;
  opacity: 0.7;
}

.no-specs {
  font-size: 12px;
  color: var(--color-tx4);
}
</style>
