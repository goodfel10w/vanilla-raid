<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRaidsStore } from '@/stores/raids'
import type { RaidLogEntry } from '@/types'

const props = defineProps<{ raidId: string }>()

const raidsStore = useRaidsStore()
const logs = ref<RaidLogEntry[]>([])
const loading = ref(false)
const expanded = ref(false)

async function fetchLog() {
  if (logs.value.length) {
    expanded.value = !expanded.value
    return
  }
  loading.value = true
  try {
    logs.value = await raidsStore.loadLog(props.raidId)
    expanded.value = true
  } finally {
    loading.value = false
  }
}

async function refresh() {
  loading.value = true
  try {
    logs.value = await raidsStore.loadLog(props.raidId)
  } finally {
    loading.value = false
  }
}

const sortedLogs = computed(() =>
  [...logs.value].sort((a, b) => b.timestamp.localeCompare(a.timestamp))
)

const ACTION_LABELS: Record<string, string> = {
  'signup': 'Angemeldet',
  'signup-changed': 'Anmeldung geaendert',
  'unsignup': 'Abgemeldet',
  'confirm': 'Bestaetigt',
  'unconfirm': 'Bestaetigung zurueckgenommen',
  'bench': 'Auf Bank gesetzt',
  'remove-signup': 'Entfernt',
  'assign-spec': 'Spec zugewiesen',
  'signup-other': 'Manuell angemeldet',
  'confirm-lineup': 'Lineup bestaetigt',
  'raid-locked': 'Raid gesperrt',
  'raid-unlocked': 'Raid entsperrt',
}

function actionLabel(action: string): string {
  return ACTION_LABELS[action] || action
}

function actionColor(action: string): string {
  if (action === 'signup' || action === 'confirm' || action === 'confirm-lineup') return 'var(--color-heal)'
  if (action === 'unsignup' || action === 'remove-signup') return 'var(--color-dps)'
  if (action === 'bench') return '#ff9800'
  if (action === 'raid-locked') return 'var(--color-dps)'
  if (action === 'raid-unlocked') return 'var(--color-heal)'
  return 'var(--color-tx2)'
}

function fmtTime(ts: string): string {
  const d = new Date(ts)
  return d.toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}
</script>

<template>
  <div class="raid-log">
    <button class="log-toggle" @click="fetchLog" :disabled="loading">
      {{ loading ? 'Laden...' : expanded ? 'Aktivitaetslog ausblenden' : 'Aktivitaetslog anzeigen' }}
    </button>

    <div v-if="expanded" class="log-content">
      <div class="log-header">
        <span class="log-title">Aktivitaetslog</span>
        <button class="log-refresh" @click="refresh" :disabled="loading">Aktualisieren</button>
      </div>

      <div v-if="!sortedLogs.length" class="log-empty">Keine Eintraege vorhanden.</div>

      <div v-else class="log-entries">
        <div v-for="entry in sortedLogs" :key="entry.id" class="log-entry">
          <span class="log-time">{{ fmtTime(entry.timestamp) }}</span>
          <span class="log-action" :style="{ color: actionColor(entry.action) }">
            {{ actionLabel(entry.action) }}
          </span>
          <span v-if="entry.targetPlayer" class="log-target">{{ entry.targetPlayer }}</span>
          <span class="log-by">von {{ entry.performedBy }}</span>
          <span v-if="entry.details" class="log-details">{{ entry.details }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.raid-log {
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
}
.log-toggle {
  font: 13px var(--font-body);
  color: var(--color-gold);
  background: none;
  border: 1px solid rgba(201, 168, 76, 0.3);
  border-radius: 6px;
  padding: 6px 14px;
  cursor: pointer;
}
.log-toggle:disabled { opacity: 0.5; }
.log-content { margin-top: 12px; }
.log-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.log-title {
  font: 700 14px var(--font-heading);
  color: var(--color-gold);
}
.log-refresh {
  font-size: 11px;
  color: var(--color-tx3);
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 2px 8px;
  cursor: pointer;
}
.log-refresh:disabled { opacity: 0.5; }
.log-empty {
  font-size: 12px;
  color: var(--color-tx4);
  padding: 8px 0;
}
.log-entries {
  max-height: 320px;
  overflow-y: auto;
}
.log-entry {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 4px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  font-size: 12px;
}
.log-entry:last-child { border-bottom: none; }
.log-time {
  color: var(--color-tx4);
  font-size: 11px;
  min-width: 90px;
}
.log-action {
  font-weight: 600;
  font-size: 11px;
}
.log-target {
  color: var(--color-tx);
  font-weight: 600;
}
.log-by {
  color: var(--color-tx4);
  font-size: 11px;
}
.log-details {
  color: var(--color-tx3);
  font-size: 11px;
  font-style: italic;
}
</style>
