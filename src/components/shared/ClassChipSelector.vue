<script setup lang="ts">
import { CLS, WOW_ICONS } from '@/lib/constants'

const props = defineProps<{
  modelValue: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

function selectClass(name: string) {
  emit('update:modelValue', name)
}
</script>

<template>
  <div class="chips" role="radiogroup" aria-label="Klasse">
    <div
      v-for="cls in CLS"
      :key="cls.name"
      class="chip"
      :class="{ active: modelValue === cls.name }"
      role="radio"
      :aria-checked="modelValue === cls.name ? 'true' : 'false'"
      :style="modelValue === cls.name ? {
        borderColor: cls.color,
        color: cls.color,
        background: cls.color + '18'
      } : {}"
      tabindex="0"
      @click="selectClass(cls.name)"
      @keydown.space.prevent="selectClass(cls.name)"
      @keydown.enter.prevent="selectClass(cls.name)"
    >
      <img
        class="wow-ico"
        :src="`${WOW_ICONS}/class/64/${cls.icon}.png`"
        :alt="cls.name"
        loading="lazy"
      />
      {{ cls.name }}
    </div>
  </div>
</template>

<style scoped>
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.chip {
  padding: 6px 13px;
  border-radius: 6px;
  cursor: pointer;
  font: 600 12px var(--font-body);
  border: 2px solid var(--color-border);
  background: rgba(0, 0, 0, 0.2);
  color: var(--color-tx3);
  transition: all 0.15s;
  user-select: none;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.chip:hover {
  border-color: rgba(255, 255, 255, 0.12);
}

.wow-ico {
  width: 20px;
  height: 20px;
  border-radius: 4px;
}
</style>
