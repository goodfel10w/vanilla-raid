<script setup lang="ts">
import { computed } from 'vue'
import { ROLES, ROLE_ICONS, ROLE_COLORS } from '@/lib/constants'
import type { RoleName } from '@/lib/constants'
import type { Entry } from '@/types'
import { cc } from '@/lib/utils'

const props = defineProps<{
  entries: Entry[]
}>()

interface ClassBreakdown {
  name: string
  count: number
  color: string
}

interface RoleCard {
  role: RoleName
  count: number
  icon: string
  color: string
  classes: ClassBreakdown[]
}

const roleCards = computed<RoleCard[]>(() => {
  return ROLES.map(r => {
    const members = props.entries.filter(e => (e.roles || []).includes(r))
    const classCounts: Record<string, number> = {}
    members.forEach(e => {
      classCounts[e.className] = (classCounts[e.className] || 0) + 1
    })
    const classes = Object.entries(classCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count, color: cc(name) }))
    return { role: r, count: members.length, icon: ROLE_ICONS[r], color: ROLE_COLORS[r], classes }
  })
})
</script>

<template>
  <div class="rsumm">
    <div v-for="card in roleCards" :key="card.role" class="card rcard">
      <div class="ico">{{ card.icon }}</div>
      <div class="num" :style="{ color: card.color }">{{ card.count }}</div>
      <div class="rl">{{ card.role }}</div>
      <div class="rcls-list">
        <template v-if="card.classes.length">
          <div v-for="cl in card.classes" :key="cl.name" class="rcls-row">
            <span class="rcls-dot" :style="{ background: cl.color }"></span>
            <span class="rcls-name" :style="{ color: cl.color }">{{ cl.name }}</span>
            <span class="rcls-ct">{{ cl.count }}</span>
          </div>
        </template>
        <div v-else class="rcls-empty">&mdash;</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rsumm {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}

.rcard {
  text-align: center;
  padding: 16px 12px;
}

.ico {
  font-size: 22px;
  margin-bottom: 4px;
}

.num {
  font-size: 28px;
  font-weight: 800;
  font-family: var(--font-heading);
}

.rl {
  font-size: 12px;
  color: var(--color-tx3);
  margin-bottom: 8px;
}

.rcls-list {
  font-size: 11px;
  text-align: left;
}

.rcls-row {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 2px 0;
}

.rcls-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.rcls-name {
  flex: 1;
}

.rcls-ct {
  color: var(--color-tx4);
  font-weight: 600;
}

.rcls-empty {
  color: var(--color-tx5);
  text-align: center;
}
</style>
