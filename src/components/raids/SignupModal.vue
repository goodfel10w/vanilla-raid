<script setup lang="ts">
import { computed } from 'vue'
import { CLS, CLASS_SPECS, WOW_ICONS, ROLE_COLORS } from '@/lib/constants'
import type { Entry } from '@/types'

const props = defineProps<{
  open: boolean
  myChars: Entry[]
  selectedChar: string
  selectedClass: string
  selectedStatus: string
  selectedSpecs: string[]
  note: string
  submitting: boolean
}>()

const emit = defineEmits<{
  'update:selectedChar': [val: string]
  'update:selectedClass': [val: string]
  'update:selectedStatus': [val: string]
  'update:note': [val: string]
  charChange: [charName: string]
  classChange: [cls: string]
  toggleSpec: [spec: string]
  confirm: []
  cancel: []
}>()

const availableSpecs = computed(() => CLASS_SPECS[props.selectedClass] || [])

function specRole(specName: string): string {
  const sp = availableSpecs.value.find(s => s.name === specName)
  return sp?.role || 'DPS'
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="modal-bg" @click.self="emit('cancel')">
      <div class="modal signup-modal">
        <div class="modal-title">Anmeldung</div>

        <div class="su-form">
          <!-- Character selection -->
          <div class="su-row">
            <template v-if="myChars.length">
              <select
                :value="selectedChar"
                @change="emit('charChange', ($event.target as HTMLSelectElement).value)"
                class="su-select"
              >
                <option value="">-- Charakter --</option>
                <option
                  v-for="ch in myChars"
                  :key="ch.charName"
                  :value="ch.charName"
                >
                  {{ ch.charName }} ({{ ch.className }})
                </option>
              </select>
            </template>
            <template v-else>
              <input
                type="text"
                :value="selectedChar"
                @input="emit('update:selectedChar', ($event.target as HTMLInputElement).value)"
                placeholder="Charaktername"
                class="su-input"
              />
              <select
                :value="selectedClass"
                @change="emit('classChange', ($event.target as HTMLSelectElement).value)"
                class="su-select"
              >
                <option value="">-- Klasse --</option>
                <option v-for="c in CLS" :key="c.name" :value="c.name">{{ c.name }}</option>
              </select>
            </template>

            <select
              :value="selectedStatus"
              @change="emit('update:selectedStatus', ($event.target as HTMLSelectElement).value)"
              class="su-select"
            >
              <option value="accepted">Dabei</option>
              <option value="tentative">Vielleicht</option>
              <option value="declined">Absage</option>
            </select>
          </div>

          <!-- Spec selection -->
          <div v-if="availableSpecs.length" class="su-specs">
            <span class="su-specs-label">Angebotene Specs (Mehrfachauswahl):</span>
            <div class="rchips">
              <div
                v-for="sp in availableSpecs"
                :key="sp.name"
                :class="['rchip', { active: selectedSpecs.includes(sp.name) }]"
                :style="selectedSpecs.includes(sp.name) ? {
                  borderColor: ROLE_COLORS[sp.role],
                  color: ROLE_COLORS[sp.role],
                  background: ROLE_COLORS[sp.role] + '18',
                } : {}"
                @click="emit('toggleSpec', sp.name)"
              >
                <img
                  class="wow-ico-sm"
                  :src="`${WOW_ICONS}/spec/${sp.icon}.png`"
                  :alt="sp.name"
                  loading="lazy"
                />
                {{ sp.name }}
              </div>
            </div>
          </div>
          <div v-else class="su-specs">
            <span class="su-specs-label">Klasse waehlen</span>
          </div>

          <!-- Note + actions -->
          <div class="su-actions">
            <input
              type="text"
              :value="note"
              @input="emit('update:note', ($event.target as HTMLInputElement).value)"
              placeholder="Anmerkung (optional)"
              class="su-note"
            />
            <button
              class="btn-signup"
              :disabled="submitting"
              @click="emit('confirm')"
            >
              {{ submitting ? '...' : 'Bestaetigen' }}
            </button>
            <button class="btn-s su-cancel" @click="emit('cancel')">Abbrechen</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-bg {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 500;
  animation: fadeIn 0.15s ease;
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
.modal {
  background: #1a1828;
  border: 1px solid rgba(201, 168, 76, 0.25);
  border-radius: 12px;
  padding: 24px;
  max-width: 500px;
  width: 90%;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}
.modal-title {
  font-family: var(--font-heading);
  font-size: 18px;
  font-weight: 700;
  color: var(--color-gold);
  margin-bottom: 16px;
}
.su-form { display: flex; flex-direction: column; gap: 12px; }
.su-row { display: flex; gap: 8px; flex-wrap: wrap; }
.su-select, .su-input {
  padding: 8px 10px;
  font-size: 13px;
  font-family: var(--font-body);
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-tx);
  flex: 1;
  min-width: 100px;
}
.su-specs { display: flex; flex-direction: column; gap: 4px; }
.su-specs-label { font-size: 12px; color: var(--color-tx3); }
.rchips { display: flex; flex-wrap: wrap; gap: 6px; }
.rchip {
  font-size: 12px;
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background: rgba(0, 0, 0, 0.2);
  color: var(--color-tx2);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: all 0.15s;
}
.rchip.active {
  font-weight: 600;
}
.wow-ico-sm { width: 14px; height: 14px; border-radius: 2px; }
.su-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}
.su-note {
  flex: 1;
  padding: 6px 10px;
  font-size: 12px;
  font-family: var(--font-body);
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-tx);
}
.btn-signup {
  padding: 8px 16px;
  border-radius: 6px;
  border: none;
  background: linear-gradient(135deg, var(--color-gold), var(--color-gold-dark));
  color: var(--color-bg);
  font: 700 13px var(--font-body);
  cursor: pointer;
  white-space: nowrap;
}
.btn-signup:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-s {
  padding: 6px 14px;
  font-size: 12px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background: none;
  color: var(--color-tx2);
  cursor: pointer;
  white-space: nowrap;
}
</style>
