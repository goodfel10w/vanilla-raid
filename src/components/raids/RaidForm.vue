<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { TBC_RAIDS } from '@/lib/constants'
import { useRaidsStore } from '@/stores/raids'
import { useToast } from '@/composables/useToast'
import type { Raid } from '@/types'

const props = defineProps<{
  editRaid?: Raid | null
}>()

const emit = defineEmits<{
  saved: []
  cancel: []
}>()

const raidsStore = useRaidsStore()
const { toast } = useToast()

const instance = ref('')
const date = ref('')
const time = ref('20:00')
const maxPlayers = ref(25)
const deadline = ref('')
const description = ref('')
const notes = ref('')
const submitting = ref(false)

const isEdit = computed(() => !!props.editRaid)
const isValid = computed(() => !!instance.value && !!date.value && !!time.value)

const todayStr = computed(() => new Date().toISOString().slice(0, 10))

watch(() => props.editRaid, (r) => {
  if (r) {
    instance.value = r.instance
    date.value = r.date
    time.value = r.time
    maxPlayers.value = r.maxPlayers
    notes.value = r.notes || ''
    description.value = r.description || ''
    deadline.value = r.deadline ? r.deadline.slice(0, 16) : ''
  } else {
    instance.value = ''
    date.value = ''
    time.value = '20:00'
    maxPlayers.value = 25
    notes.value = ''
    description.value = ''
    deadline.value = ''
  }
}, { immediate: true })

function onInstanceChange() {
  const inst = TBC_RAIDS.find(i => i.name === instance.value)
  if (inst) {
    maxPlayers.value = inst.maxPlayers
  }
}

async function submit() {
  if (!isValid.value || submitting.value) return
  submitting.value = true
  try {
    await raidsStore.save({
      id: props.editRaid?.id || undefined,
      instance: instance.value,
      date: date.value,
      time: time.value,
      maxPlayers: maxPlayers.value,
      notes: notes.value,
      description: description.value,
      deadline: deadline.value || undefined,
    } as Partial<Raid>)
    toast(isEdit.value ? 'Raid aktualisiert' : 'Raid erstellt')
    emit('saved')
  } catch (e: any) {
    toast('Fehler: ' + (e.message || e))
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="card raid-form">
    <div class="fld">
      <span class="lbl">Instanz</span>
      <select v-model="instance" @change="onInstanceChange" class="rf-select">
        <option value="">-- Instanz waehlen --</option>
        <option
          v-for="inst in TBC_RAIDS"
          :key="inst.name"
          :value="inst.name"
        >
          {{ inst.name }} ({{ inst.maxPlayers }} Spieler, {{ inst.tier }})
        </option>
      </select>
    </div>

    <div class="fld">
      <span class="lbl">Datum</span>
      <input type="date" v-model="date" :min="todayStr" class="rf-input" />
    </div>

    <div class="fld">
      <span class="lbl">Uhrzeit</span>
      <input type="time" v-model="time" class="rf-input" />
    </div>

    <div class="fld">
      <span class="lbl">Max. Spieler</span>
      <input type="number" v-model.number="maxPlayers" min="1" class="rf-input" />
    </div>

    <div class="fld">
      <span class="lbl">Anmeldefrist (optional)</span>
      <span class="lbl-s">Nach Ablauf koennen sich Spieler nicht mehr anmelden.</span>
      <input type="datetime-local" v-model="deadline" class="rf-input" />
    </div>

    <div class="fld">
      <span class="lbl">Beschreibung (optional)</span>
      <textarea
        v-model="description"
        placeholder="Beschreibe den Raid..."
        class="rf-textarea"
      ></textarea>
    </div>

    <div class="fld">
      <span class="lbl">Anmerkungen (optional)</span>
      <input
        type="text"
        v-model="notes"
        placeholder="z.B. Consumables mitbringen"
        class="rf-input"
      />
    </div>

    <div class="brow">
      <button
        class="btn-p"
        id="rf-submit"
        :disabled="!isValid || submitting"
        @click="submit"
      >
        {{ submitting ? 'Speichern...' : isEdit ? 'Aktualisieren' : 'Erstellen' }}
      </button>
      <button class="btn-s" @click="emit('cancel')">Abbrechen</button>
    </div>
  </div>
</template>

<style scoped>
.raid-form {
  padding: 28px;
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
}
.fld {
  margin-bottom: 16px;
}
.lbl {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-tx2);
  margin-bottom: 4px;
}
.lbl-s {
  display: block;
  font-size: 11px;
  color: var(--color-tx4);
  margin-bottom: 4px;
}
.rf-select, .rf-input, .rf-textarea {
  width: 100%;
  padding: 10px 12px;
  font-size: 13px;
  font-family: var(--font-body);
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-tx);
}
.rf-select:focus, .rf-input:focus, .rf-textarea:focus {
  border-color: var(--color-gold);
  outline: none;
}
.rf-textarea {
  min-height: 80px;
  resize: vertical;
}
.brow {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}
.btn-p {
  padding: 10px 24px;
  border-radius: 8px;
  border: none;
  background: linear-gradient(135deg, var(--color-gold), var(--color-gold-dark));
  color: var(--color-bg);
  font: 700 14px var(--font-body);
  cursor: pointer;
  transition: filter 0.15s;
}
.btn-p:hover:not(:disabled) { filter: brightness(1.1); }
.btn-p:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-s {
  padding: 10px 24px;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background: none;
  color: var(--color-tx2);
  font: 14px var(--font-body);
  cursor: pointer;
}
.btn-s:hover { background: rgba(255, 255, 255, 0.05); }
</style>
