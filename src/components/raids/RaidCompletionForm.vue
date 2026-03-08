<script setup lang="ts">
import { ref, computed } from 'vue'
import { useDkpStore } from '@/stores/dkp'
import { useToast } from '@/composables/useToast'
import { cc } from '@/lib/utils'
import ClassIcon from '@/components/shared/ClassIcon.vue'
import type { RaidSignup, RaidPointCategory } from '@/types'

const props = defineProps<{
  raidInstance: string
  raidDate: string
  activeSignups: RaidSignup[]
  benchedSignups: RaidSignup[]
}>()

const emit = defineEmits<{ close: [], completed: [] }>()

const dkp = useDkpStore()
const { toast } = useToast()

const categories = computed<RaidPointCategory[]>(() => dkp.config.raidPointCategories || [])

// Track which categories are enabled
const enabledCategories = ref<Set<string>>(new Set())

// Track selected players per category (key = categoryId)
const categoryPlayers = ref<Map<string, Set<string>>>(new Map())

// Bench percentage
const benchPercent = ref(50)
const includeBench = ref(false)

function toggleCategory(catId: string) {
  if (enabledCategories.value.has(catId)) {
    enabledCategories.value.delete(catId)
    categoryPlayers.value.delete(catId)
  } else {
    enabledCategories.value.add(catId)
    // Pre-select all active (non-declined, non-benched) players
    const playerSet = new Set(props.activeSignups.map(s => s.charName))
    categoryPlayers.value.set(catId, playerSet)
  }
  // Force reactivity
  enabledCategories.value = new Set(enabledCategories.value)
  categoryPlayers.value = new Map(categoryPlayers.value)
}

function togglePlayer(catId: string, charName: string) {
  const players = categoryPlayers.value.get(catId)
  if (!players) return
  if (players.has(charName)) {
    players.delete(charName)
  } else {
    players.add(charName)
  }
  categoryPlayers.value = new Map(categoryPlayers.value)
}

function isPlayerSelected(catId: string, charName: string): boolean {
  return categoryPlayers.value.get(catId)?.has(charName) || false
}

function selectAllForCategory(catId: string) {
  const players = categoryPlayers.value.get(catId)
  if (!players) return
  if (players.size === props.activeSignups.length) {
    players.clear()
  } else {
    props.activeSignups.forEach(s => players.add(s.charName))
  }
  categoryPlayers.value = new Map(categoryPlayers.value)
}

// Preview calculations
const previewLines = computed(() => {
  const lines: { category: string; playerCount: number; points: number; total: number; bench: boolean }[] = []
  for (const cat of categories.value) {
    if (!enabledCategories.value.has(cat.id)) continue
    const players = categoryPlayers.value.get(cat.id)
    const count = players?.size || 0
    if (count > 0) {
      lines.push({ category: cat.name, playerCount: count, points: cat.points, total: count * cat.points, bench: false })
    }
    if (includeBench.value && props.benchedSignups.length > 0) {
      const benchPoints = Math.round(cat.points * benchPercent.value / 100)
      if (benchPoints > 0) {
        lines.push({ category: cat.name + ' (Bank)', playerCount: props.benchedSignups.length, points: benchPoints, total: props.benchedSignups.length * benchPoints, bench: true })
      }
    }
  }
  return lines
})

const grandTotal = computed(() => previewLines.value.reduce((sum, l) => sum + l.total, 0))

const canSubmit = computed(() => enabledCategories.value.size > 0 && previewLines.value.some(l => l.playerCount > 0))

const submitting = ref(false)

async function doComplete() {
  if (!canSubmit.value || submitting.value) return
  submitting.value = true
  try {
    for (const cat of categories.value) {
      if (!enabledCategories.value.has(cat.id)) continue
      const players = categoryPlayers.value.get(cat.id)
      if (!players || players.size === 0) continue

      // Build player list with className from signups
      const playerList = Array.from(players).map(name => {
        const signup = props.activeSignups.find(s => s.charName === name)
        return { name, className: signup?.className || '' }
      })

      const reason = `${props.raidInstance} — ${fmtDate(props.raidDate)} — ${cat.name}`
      await dkp.award(playerList, cat.points, reason)

      // Bench players at reduced rate
      if (includeBench.value && props.benchedSignups.length > 0) {
        const benchPoints = Math.round(cat.points * benchPercent.value / 100)
        if (benchPoints > 0) {
          const benchList = props.benchedSignups.map(s => ({ name: s.charName, className: s.className || '' }))
          const benchReason = `${props.raidInstance} — ${fmtDate(props.raidDate)} — ${cat.name} (Bank ${benchPercent.value}%)`
          await dkp.award(benchList, benchPoints, benchReason)
        }
      }
    }

    toast(`Raid-Punkte vergeben: ${grandTotal.value} DKP gesamt`)
    emit('completed')
  } catch (e: unknown) {
    toast('Fehler: ' + (e instanceof Error ? e.message : 'Unbekannter Fehler'))
  } finally {
    submitting.value = false
  }
}

function fmtDate(d: string): string {
  if (!d) return ''
  const [y, m, dd] = d.split('-')
  return `${dd}.${m}.${y}`
}
</script>

<template>
  <div class="rc-form">
    <div class="rc-header">
      <div class="card-t">Raid abschliessen</div>
      <p class="rc-subtitle">Waehle Kategorien und Spieler fuer die Punktvergabe.</p>
    </div>

    <div v-if="!categories.length" class="rc-empty">
      Keine Raid-Punkte Kategorien definiert. Erstelle Kategorien in den
      <router-link to="/dkp" style="color:var(--color-gold)">DKP-Einstellungen</router-link>.
    </div>

    <template v-else>
      <!-- Categories -->
      <div v-for="cat in categories" :key="cat.id" class="rc-category">
        <div class="rc-cat-header" @click="toggleCategory(cat.id)">
          <span class="rc-cat-check" :class="{ active: enabledCategories.has(cat.id) }">
            {{ enabledCategories.has(cat.id) ? '✓' : '' }}
          </span>
          <span class="rc-cat-name">{{ cat.name }}</span>
          <span class="rc-cat-points">{{ cat.points }} DKP</span>
        </div>

        <!-- Player selection (expanded when enabled) -->
        <div v-if="enabledCategories.has(cat.id)" class="rc-players">
          <div class="rc-players-header">
            <span class="rc-players-count">{{ categoryPlayers.get(cat.id)?.size || 0 }}/{{ activeSignups.length }} Spieler</span>
            <span class="rc-select-all" @click="selectAllForCategory(cat.id)">Alle</span>
          </div>
          <div class="rc-player-chips">
            <div
              v-for="s in activeSignups"
              :key="s.charName"
              class="rc-player-chip"
              :class="{ active: isPlayerSelected(cat.id, s.charName) }"
              :style="isPlayerSelected(cat.id, s.charName) ? { color: cc(s.className), borderColor: cc(s.className) } : {}"
              @click="togglePlayer(cat.id, s.charName)"
            >
              <ClassIcon v-if="s.className" :class-name="s.className" size="sm" />
              {{ s.charName }}
            </div>
          </div>
        </div>
      </div>

      <!-- Bench players -->
      <div v-if="benchedSignups.length" class="rc-bench-section">
        <div class="rc-cat-header" @click="includeBench = !includeBench">
          <span class="rc-cat-check" :class="{ active: includeBench }">
            {{ includeBench ? '✓' : '' }}
          </span>
          <span class="rc-cat-name">Bank-Spieler einbeziehen</span>
          <span class="rc-cat-points">{{ benchedSignups.length }} Spieler</span>
        </div>
        <div v-if="includeBench" class="rc-bench-config">
          <label class="rc-bench-label">
            Prozentsatz:
            <input v-model.number="benchPercent" type="number" min="1" max="100" class="rc-bench-input">
            <span>%</span>
          </label>
          <div class="rc-bench-players">
            <span
              v-for="s in benchedSignups"
              :key="s.charName"
              class="rc-bench-name"
              :style="{ color: s.className ? cc(s.className) : 'var(--color-tx4)' }"
            >
              <ClassIcon v-if="s.className" :class-name="s.className" size="sm" />
              {{ s.charName }}
            </span>
          </div>
        </div>
      </div>

      <!-- Preview -->
      <div v-if="previewLines.length" class="rc-preview">
        <div class="rc-preview-title">Vorschau</div>
        <div v-for="(line, i) in previewLines" :key="i" class="rc-preview-row">
          <span>{{ line.category }}</span>
          <span class="rc-preview-calc">{{ line.playerCount }} &times; {{ line.points }} = <strong>{{ line.total }}</strong></span>
        </div>
        <div class="rc-preview-total">
          Gesamt: <strong>{{ grandTotal }} DKP</strong>
        </div>
      </div>

      <!-- Actions -->
      <div class="rc-actions">
        <button class="rc-btn-cancel" @click="emit('close')">Abbrechen</button>
        <button
          class="rc-btn-submit"
          :disabled="!canSubmit || submitting"
          @click="doComplete"
        >{{ submitting ? 'Vergebe...' : 'Punkte vergeben' }}</button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.rc-form {
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
}

.card-t {
  font: 600 15px var(--font-heading);
  color: var(--color-gold);
  margin-bottom: 4px;
}

.rc-subtitle {
  font-size: 13px;
  color: var(--color-tx3);
  margin-bottom: 16px;
}

.rc-empty {
  font-size: 13px;
  color: var(--color-tx4);
  padding: 12px 0;
}

.rc-category, .rc-bench-section {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  margin-bottom: 10px;
  overflow: hidden;
}

.rc-cat-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  cursor: pointer;
  transition: background 0.15s;
}

.rc-cat-header:hover {
  background: rgba(255, 255, 255, 0.03);
}

.rc-cat-check {
  width: 20px;
  height: 20px;
  border: 2px solid var(--color-border);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--color-gold);
  flex-shrink: 0;
}

.rc-cat-check.active {
  border-color: var(--color-gold);
  background: rgba(201, 168, 76, 0.15);
}

.rc-cat-name {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-tx);
}

.rc-cat-points {
  font-size: 12px;
  color: var(--color-gold);
  font-weight: 600;
}

.rc-players {
  padding: 0 14px 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
}

.rc-players-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
}

.rc-players-count {
  font-size: 11px;
  color: var(--color-tx4);
}

.rc-select-all {
  font-size: 11px;
  color: var(--color-gold);
  cursor: pointer;
  font-weight: 600;
}

.rc-select-all:hover {
  text-decoration: underline;
}

.rc-player-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.rc-player-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 14px;
  border: 1px solid var(--color-border);
  font-size: 12px;
  color: var(--color-tx3);
  cursor: pointer;
  transition: all 0.15s;
  user-select: none;
}

.rc-player-chip:hover {
  background: rgba(255, 255, 255, 0.05);
}

.rc-player-chip.active {
  background: rgba(255, 255, 255, 0.06);
  font-weight: 600;
}

.rc-bench-config {
  padding: 10px 14px 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
}

.rc-bench-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--color-tx2);
  margin-bottom: 10px;
}

.rc-bench-input {
  width: 60px;
  padding: 4px 8px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  color: var(--color-tx);
  font: 13px var(--font-body);
  outline: none;
}

.rc-bench-input:focus {
  border-color: rgba(201, 168, 76, 0.4);
}

.rc-bench-players {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.rc-bench-name {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
}

.rc-preview {
  background: rgba(0, 0, 0, 0.15);
  border-radius: 8px;
  padding: 14px;
  margin-top: 14px;
}

.rc-preview-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-tx3);
  margin-bottom: 8px;
}

.rc-preview-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--color-tx2);
  padding: 3px 0;
}

.rc-preview-calc {
  color: var(--color-tx3);
}

.rc-preview-calc strong {
  color: var(--color-tx);
}

.rc-preview-total {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  margin-top: 8px;
  padding-top: 8px;
  font-size: 13px;
  color: var(--color-tx2);
  text-align: right;
}

.rc-preview-total strong {
  color: var(--color-green, #66bb6a);
}

.rc-actions {
  display: flex;
  gap: 10px;
  margin-top: 16px;
}

.rc-btn-cancel {
  padding: 10px 20px;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background: none;
  color: var(--color-tx2);
  cursor: pointer;
  font: 13px var(--font-body);
}

.rc-btn-submit {
  padding: 10px 24px;
  border-radius: 8px;
  border: none;
  background: linear-gradient(135deg, var(--color-gold), var(--color-gold-dark, #a88430));
  color: var(--color-bg, #0d0c14);
  cursor: pointer;
  font: 700 14px var(--font-body);
  transition: all 0.15s;
}

.rc-btn-submit:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.rc-btn-submit:not(:disabled):hover {
  filter: brightness(1.1);
}
</style>
