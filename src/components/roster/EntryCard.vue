<script setup lang="ts">
import { computed } from 'vue'
import { DAYS, DAY_SHORT, ROLES, ROLE_COLORS, ROLE_ICONS, CLASS_SPECS, WOW_ICONS } from '@/lib/constants'
import type { RoleName } from '@/lib/constants'
import type { Entry } from '@/types'
import { cc, h, collapseRanges } from '@/lib/utils'
import ClassIcon from '@/components/shared/ClassIcon.vue'

const props = defineProps<{
  entry: Entry
  canEdit: boolean
}>()

const emit = defineEmits<{
  edit: [id: string]
  delete: [id: string]
}>()

function specRole(cls: string, specName: string): RoleName {
  const cspecs = CLASS_SPECS[cls] || []
  const sp = cspecs.find(c => c.name === specName)
  return sp ? sp.role : 'DPS'
}

function specIcon(cls: string, specName: string): string {
  const cspecs = CLASS_SPECS[cls] || []
  const sp = cspecs.find(c => c.name === specName)
  return sp ? `${WOW_ICONS}/spec/${sp.icon}.png` : ''
}

const roles = computed(() => {
  const e = props.entry
  return (e.roles || []).filter((r): r is RoleName => ROLES.includes(r as RoleName))
})

interface SpecBadge {
  label: string
  role: RoleName
  color: string
  iconSrc: string
  roleIcon: string
}

const specBadges = computed<SpecBadge[]>(() => {
  const e = props.entry
  if (e.specs && e.specs.length) {
    return e.specs.map(s => {
      const r = specRole(e.className, s)
      const ico = specIcon(e.className, s)
      return { label: s, role: r, color: ROLE_COLORS[r], iconSrc: ico, roleIcon: ROLE_ICONS[r] }
    })
  }
  return roles.value.map(r => ({
    label: r,
    role: r,
    color: ROLE_COLORS[r],
    iconSrc: '',
    roleIcon: ROLE_ICONS[r],
  }))
})

interface SlotTag {
  label: string
  tentative: boolean
}

const slotTags = computed<SlotTag[]>(() => {
  const e = props.entry
  const tags: SlotTag[] = []
  DAYS.forEach(d => {
    const ranges = collapseRanges(e.availability || {}, d)
    ranges.forEach(r => {
      const isTent = r.type === 'tentative'
      const ds = DAY_SHORT[d] || d
      tags.push({ label: `${isTent ? '? ' : ''}${ds} ${r.start}\u2013${r.end}`, tentative: isTent })
    })
  })
  return tags
})
</script>

<template>
  <div class="entry">
    <div class="e-info">
      <div class="e-name" :style="{ color: cc(entry.className) }">
        <ClassIcon :class-name="entry.className" size="sm" />
        {{ entry.charName }}
      </div>
      <div class="e-class">{{ entry.className }}</div>
      <div class="e-roles">
        <span
          v-for="badge in specBadges"
          :key="badge.label"
          class="rbadge"
          :style="{ background: badge.color + '18', color: badge.color }"
        >
          <img v-if="badge.iconSrc" class="wow-ico-sm" :src="badge.iconSrc" alt="" loading="lazy" />
          <template v-else>{{ badge.roleIcon }}</template>
          {{ badge.label }}
        </span>
      </div>
    </div>
    <div class="e-slots">
      <template v-if="slotTags.length">
        <span
          v-for="(tag, i) in slotTags"
          :key="i"
          class="stag"
          :class="{ tent: tag.tentative }"
        >{{ tag.label }}</span>
      </template>
      <span v-else style="font-size:11px;color:var(--color-tx5)">Keine Zeiten</span>
    </div>
    <div v-if="entry.notes" class="e-notes">&bdquo;{{ entry.notes }}&ldquo;</div>
    <div v-if="canEdit" class="e-actions">
      <button class="btn-edit" :data-edit="entry.id" @click="emit('edit', entry.id)">Bearbeiten</button>
      <button
        class="btn-del"
        :data-del="entry.id"
        :aria-label="`Eintrag von ${entry.charName} l\u00f6schen`"
        @click="emit('delete', entry.id)"
      >&times;</button>
    </div>
  </div>
</template>

<style scoped>
.entry {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 14px 16px;
  margin-bottom: 10px;
  transition: border-color 0.15s;
}

.entry:hover {
  border-color: rgba(201, 168, 76, 0.2);
}

.e-info {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.e-name {
  font-weight: 700;
  font-size: 15px;
  display: flex;
  align-items: center;
  gap: 5px;
}

.e-class {
  font-size: 11px;
  color: var(--color-tx4);
}

.e-roles {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-left: auto;
}

.rbadge {
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 4px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.wow-ico-sm {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  vertical-align: middle;
}

.e-slots {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 6px;
}

.stag {
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 4px;
  background: rgba(201, 168, 76, 0.1);
  color: var(--color-gold);
  white-space: nowrap;
}

.stag.tent {
  background: rgba(255, 193, 7, 0.08);
  color: var(--color-yellow);
}

.e-notes {
  font-size: 12px;
  color: var(--color-tx3);
  font-style: italic;
  margin-bottom: 6px;
}

.e-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.btn-edit {
  font-size: 12px;
  padding: 4px 12px;
  border-radius: 6px;
  border: 1px solid rgba(201, 168, 76, 0.3);
  background: none;
  color: var(--color-gold);
  cursor: pointer;
  transition: all 0.15s;
}

.btn-edit:hover {
  background: rgba(201, 168, 76, 0.1);
}

.btn-del {
  font-size: 16px;
  padding: 2px 8px;
  border-radius: 6px;
  border: 1px solid rgba(255, 82, 82, 0.2);
  background: none;
  color: #ff5252;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-del:hover {
  background: rgba(255, 82, 82, 0.1);
}

@media (max-width: 640px) {
  .e-roles {
    margin-left: 0;
    width: 100%;
  }

  .btn-edit {
    padding: 8px 16px;
    min-height: 36px;
  }

  .btn-del {
    padding: 6px 12px;
    min-height: 36px;
  }
}
</style>
