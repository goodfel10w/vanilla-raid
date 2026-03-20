<script setup lang="ts">
import { computed } from 'vue'
import type { DkpTransaction } from '@/types'
import { cc, linkItems } from '@/lib/utils'
import { useDkpStore } from '@/stores/dkp'

const props = defineProps<{
  tx: DkpTransaction
  showActions?: boolean
}>()

const emit = defineEmits<{
  edit: [id: string]
  delete: [id: string]
}>()

const dkp = useDkpStore()

const typeCls = computed(() => {
  const t = props.tx.type
  return t === 'earn' ? 'dkp-tx-earn' : t === 'spend' ? 'dkp-tx-spend' : t === 'adjust' ? 'dkp-tx-adjust' : 'dkp-tx-decay'
})

const typeLabel = computed(() => {
  const t = props.tx.type
  return t === 'earn' ? 'Verdient' : t === 'spend' ? 'Beute' : t === 'adjust' ? 'Anpassung' : 'Verfall'
})

const amtCls = computed(() =>
  props.tx.amount > 0 ? 'dkp-pos' : props.tx.amount < 0 ? 'dkp-neg' : 'dkp-zero'
)

const amtStr = computed(() =>
  props.tx.amount > 0 ? '+' + props.tx.amount : String(props.tx.amount)
)

const playerColor = computed(() => {
  const bal = dkp.balances.find(b => b.playerName === props.tx.playerName)
  return cc(bal?.className || '')
})

const dateStr = computed(() => {
  const date = new Date(props.tx.timestamp)
  return String(date.getDate()).padStart(2, '0') + '.' +
    String(date.getMonth() + 1).padStart(2, '0') + '. ' +
    String(date.getHours()).padStart(2, '0') + ':' +
    String(date.getMinutes()).padStart(2, '0')
})

const reasonHtml = computed(() => {
  if (props.tx.type === 'spend') return linkItems(props.tx.reason)
  // For non-spend, HTML escape the reason. Vue's {{ }} auto-escapes so we use v-text for plain.
  return ''
})

const edited = computed(() => !!('editedAt' in props.tx && props.tx.editedAt))
</script>

<template>
  <div class="dkp-tx">
    <span class="dkp-tx-type" :class="typeCls">{{ typeLabel }}</span>
    <span class="dkp-tx-name" :style="{ color: playerColor }">{{ tx.playerName }}</span>
    <span v-if="tx.type === 'spend'" class="dkp-tx-reason" v-html="reasonHtml"></span>
    <span v-else class="dkp-tx-reason">{{ tx.reason }}<span v-if="edited" class="dkp-tx-edited"> (bearbeitet)</span></span>
    <span class="dkp-tx-amount" :class="amtCls">{{ amtStr }}</span>
    <span class="dkp-tx-meta">{{ tx.createdBy || '' }} &middot; {{ dateStr }}</span>
    <span v-if="showActions" class="dkp-tx-actions">
      <button class="dkp-tx-btn" aria-label="Bearbeiten" @click.stop="emit('edit', tx.id)">&#x270E;</button>
      <button class="dkp-tx-btn dkp-tx-del" aria-label="Löschen" @click.stop="emit('delete', tx.id)">&#x2715;</button>
    </span>
  </div>
</template>

<style scoped>
.dkp-tx {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  font-size: 13px;
  flex-wrap: wrap;
}

.dkp-tx:last-child {
  border-bottom: none;
}

.dkp-tx-type {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.dkp-tx-earn { background: rgba(102, 187, 106, 0.15); color: var(--color-green); }
.dkp-tx-spend { background: rgba(229, 115, 115, 0.15); color: var(--color-red, #e57373); }
.dkp-tx-decay { background: rgba(255, 213, 79, 0.15); color: var(--color-yellow, #ffd54f); }
.dkp-tx-adjust { background: rgba(201, 168, 76, 0.15); color: var(--color-gold); }

.dkp-tx-name {
  font-weight: 600;
  white-space: nowrap;
}

.dkp-tx-reason {
  flex: 1;
  color: var(--color-tx3);
  min-width: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dkp-tx-edited {
  font-size: 10px;
  color: var(--color-tx4);
  font-style: italic;
}

.dkp-tx-amount {
  font-weight: 700;
  white-space: nowrap;
}

.dkp-pos { color: var(--color-green); }
.dkp-neg { color: var(--color-red, #e57373); }
.dkp-zero { color: var(--color-tx3); }

.dkp-tx-meta {
  font-size: 11px;
  color: var(--color-tx4);
  white-space: nowrap;
}

.dkp-tx-actions {
  display: flex;
  gap: 4px;
}

.dkp-tx-btn {
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: none;
  color: var(--color-tx3);
  cursor: pointer;
  font-size: 12px;
  transition: all 0.15s;
}

.dkp-tx-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--color-tx);
}

.dkp-tx-del:hover {
  background: rgba(229, 115, 115, 0.15);
  color: var(--color-red, #e57373);
}

@media (max-width: 767px) {
  .dkp-tx {
    padding: 10px 0;
  }

  .dkp-tx-btn {
    padding: 6px 10px;
    min-height: 32px;
    min-width: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}
</style>
