<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useEntriesStore } from '@/stores/entries'
import { WEEKDAYS, WEEKEND, DAY_SHORT, ROLE_ICONS, ROLE_COLORS } from '@/lib/constants'
import { cc, h } from '@/lib/utils'
import { useHeatmapData } from '@/composables/useHeatmapData'
import type { HeatDatum, PlayerWithAvailType } from '@/composables/useHeatmapData'

const entriesStore = useEntriesStore()
const {
  heatMode, setHeatMode,
  currentHeatData, currentLabels,
  playersForCell, isRaidReady, topSlots,
} = useHeatmapData(() => entriesStore.entries)

const tooltipRef = ref<HTMLDivElement | null>(null)
const tooltipHtml = ref('')
const tooltipStyle = ref({ left: '0px', top: '0px' })
const tooltipVisible = ref(false)
const tooltipArrowClass = ref<'arrow-down' | 'arrow-up'>('arrow-down')
const tooltipArrowLeft = ref('50%')

function maxTotal(): number {
  const hd = currentHeatData.value
  return Math.max(1, ...Object.values(hd).map(v => v.total))
}

function cellData(d: string, label: string): { datum: HeatDatum; players: PlayerWithAvailType[] } {
  const hd = currentHeatData.value
  const k = d + '_' + label
  const datum = hd[k] || { yes: 0, tent: 0, total: 0 }
  const players = playersForCell(d, label)
  return { datum, players }
}

function cellBg(total: number, mx: number): string {
  if (!total) return 'rgba(255,255,255,.02)'
  const i = total / mx
  return `rgba(201,168,76,${0.08 + i * 0.35})`
}

function cellColor(total: number, mx: number): string {
  if (!total) return '#2a2538'
  const i = total / mx
  return `rgba(201,168,76,${0.4 + i * 0.6})`
}

function cellBorder(total: number, mx: number): string {
  if (!total) return '1px solid rgba(201,168,76,.02)'
  const i = total / mx
  return `1px solid rgba(201,168,76,${0.1 + i * 0.3})`
}

function onCellEnter(e: MouseEvent) {
  const cell = (e.target as HTMLElement).closest('.hcell') as HTMLElement | null
  if (!cell) return
  const tpl = cell.querySelector('.tip-content') as HTMLElement | null
  if (!tpl) return
  tooltipHtml.value = tpl.innerHTML
  tooltipVisible.value = true

  requestAnimationFrame(() => {
    const tip = tooltipRef.value
    if (!tip) return
    const r = cell.getBoundingClientRect()
    const tw = tip.offsetWidth || 160
    const th = tip.offsetHeight || 40
    const above = r.top - th - 10 > 0
    const top = above ? r.top - th - 10 : r.bottom + 10
    let left = r.left + r.width / 2 - tw / 2
    const margin = 4
    if (left < margin) left = margin
    if (left + tw > window.innerWidth - margin) left = window.innerWidth - margin - tw
    const cellCenter = r.left + r.width / 2
    const arrowLeft = Math.max(12, Math.min(tw - 12, cellCenter - left))
    tooltipStyle.value = { left: left + 'px', top: top + 'px' }
    tooltipArrowLeft.value = arrowLeft + 'px'
    tooltipArrowClass.value = above ? 'arrow-down' : 'arrow-up'
  })
}

function onCellLeave(e: MouseEvent) {
  const cell = (e.target as HTMLElement).closest('.hcell')
  if (!cell) return
  tooltipVisible.value = false
}

function slotDisplayTime(key: string): string {
  const sep = key.indexOf('_')
  const d = key.substring(0, sep)
  const s = key.substring(sep + 1)
  const ds = DAY_SHORT[d] || d
  const isWindow = heatMode.value !== '1h'
  return `${ds} ${isWindow ? s : s + ':00'}`
}
</script>

<template>
  <div id="v-heatmap" @mouseenter.capture="onCellEnter" @mouseleave.capture="onCellLeave">
    <div class="heat-toggle">
      <button class="ht-btn" :class="{ active: heatMode === '1h' }" @click="setHeatMode('1h')">1h Stunden</button>
      <button class="ht-btn" :class="{ active: heatMode === '3h' }" @click="setHeatMode('3h')">3h Fenster</button>
      <button class="ht-btn" :class="{ active: heatMode === '4h' }" @click="setHeatMode('4h')">4h Raid</button>
    </div>

    <p class="center" style="font-size:13px;color:var(--color-tx3);margin-bottom:16px">
      Heller = mehr Raider &middot; Hover f&uuml;r Details &middot; Gr&uuml;ner Rand = Raid-Ready
      <template v-if="heatMode !== '1h'">
        &middot; {{ heatMode === '4h' ? '4h' : '3h' }} = alle Viertelstunden im Fenster verf&uuml;gbar
      </template>
    </p>

    <div class="card" style="overflow-x:auto">
      <div class="sec-l">Unter der Woche</div>
      <table class="htable">
        <thead>
          <tr>
            <th></th>
            <th v-for="col in currentLabels" :key="col">{{ col }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="d in WEEKDAYS" :key="d">
            <td class="dl">{{ d }}</td>
            <td v-for="col in currentLabels" :key="col">
              <div
                class="hcell"
                :class="{ 'raid-ready': isRaidReady(playersForCell(d, col)).ready }"
                :style="{
                  background: cellBg(cellData(d, col).datum.total, maxTotal()),
                  color: cellColor(cellData(d, col).datum.total, maxTotal()),
                  border: cellBorder(cellData(d, col).datum.total, maxTotal()),
                }"
              >
                <template v-if="cellData(d, col).datum.tent > 0">
                  {{ cellData(d, col).datum.yes }}<span style="font-size:12px;font-weight:400;color:var(--color-yellow)">+{{ cellData(d, col).datum.tent }}</span>
                </template>
                <template v-else>{{ cellData(d, col).datum.total }}</template>
                <div v-if="cellData(d, col).datum.total > 0" class="hcell-roles">
                  <span style="color:var(--color-tank)">{{ isRaidReady(playersForCell(d, col)).t }}T</span>
                  <span style="color:var(--color-heal)">{{ isRaidReady(playersForCell(d, col)).hl }}H</span>
                  <span style="color:var(--color-dps)">{{ isRaidReady(playersForCell(d, col)).dp }}D</span>
                </div>
                <template class="tip-content">
                  <div v-if="cellData(d, col).datum.total > 0" style="margin-bottom:4px;font-weight:600">
                    {{ ROLE_ICONS.Tank }}{{ isRaidReady(playersForCell(d, col)).t }}
                    {{ ROLE_ICONS.Heiler }}{{ isRaidReady(playersForCell(d, col)).hl }}
                    {{ ROLE_ICONS.DPS }}{{ isRaidReady(playersForCell(d, col)).dp }}
                    <span v-if="isRaidReady(playersForCell(d, col)).ready"> &mdash; <span style="color:var(--color-green)">Raid-Ready!</span></span>
                  </div>
                  <template v-if="playersForCell(d, col).length">
                    <div
                      v-for="p in playersForCell(d, col)"
                      :key="p.id"
                      :style="{ color: p._availType === 'tentative' ? 'var(--color-yellow)' : cc(p.className) }"
                    >{{ p._availType === 'tentative' ? '(?) ' : '' }}{{ p.charName }}</div>
                  </template>
                  <div v-else style="color:var(--color-tx4)">Niemand</div>
                </template>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="card" style="overflow-x:auto">
      <div class="sec-l">Wochenende</div>
      <table class="htable">
        <thead>
          <tr>
            <th></th>
            <th v-for="col in currentLabels" :key="col">{{ col }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="d in WEEKEND" :key="d">
            <td class="dl">{{ d }}</td>
            <td v-for="col in currentLabels" :key="col">
              <div
                class="hcell"
                :class="{ 'raid-ready': isRaidReady(playersForCell(d, col)).ready }"
                :style="{
                  background: cellBg(cellData(d, col).datum.total, maxTotal()),
                  color: cellColor(cellData(d, col).datum.total, maxTotal()),
                  border: cellBorder(cellData(d, col).datum.total, maxTotal()),
                }"
              >
                <template v-if="cellData(d, col).datum.tent > 0">
                  {{ cellData(d, col).datum.yes }}<span style="font-size:12px;font-weight:400;color:var(--color-yellow)">+{{ cellData(d, col).datum.tent }}</span>
                </template>
                <template v-else>{{ cellData(d, col).datum.total }}</template>
                <div v-if="cellData(d, col).datum.total > 0" class="hcell-roles">
                  <span style="color:var(--color-tank)">{{ isRaidReady(playersForCell(d, col)).t }}T</span>
                  <span style="color:var(--color-heal)">{{ isRaidReady(playersForCell(d, col)).hl }}H</span>
                  <span style="color:var(--color-dps)">{{ isRaidReady(playersForCell(d, col)).dp }}D</span>
                </div>
                <template class="tip-content">
                  <div v-if="cellData(d, col).datum.total > 0" style="margin-bottom:4px;font-weight:600">
                    {{ ROLE_ICONS.Tank }}{{ isRaidReady(playersForCell(d, col)).t }}
                    {{ ROLE_ICONS.Heiler }}{{ isRaidReady(playersForCell(d, col)).hl }}
                    {{ ROLE_ICONS.DPS }}{{ isRaidReady(playersForCell(d, col)).dp }}
                    <span v-if="isRaidReady(playersForCell(d, col)).ready"> &mdash; <span style="color:var(--color-green)">Raid-Ready!</span></span>
                  </div>
                  <template v-if="playersForCell(d, col).length">
                    <div
                      v-for="p in playersForCell(d, col)"
                      :key="p.id"
                      :style="{ color: p._availType === 'tentative' ? 'var(--color-yellow)' : cc(p.className) }"
                    >{{ p._availType === 'tentative' ? '(?) ' : '' }}{{ p.charName }}</div>
                  </template>
                  <div v-else style="color:var(--color-tx4)">Niemand</div>
                </template>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Top raid windows -->
    <div v-if="topSlots.length" class="center" style="margin-top:20px">
      <div class="sec-l" style="margin-bottom:10px">
        Top {{ Math.min(5, topSlots.length) }} Raidzeiten{{ heatMode !== '1h' ? ` (${heatMode === '4h' ? '4h' : '3h'})` : '' }}
      </div>
      <div class="top-slots">
        <div
          v-for="([k, dat], i) in topSlots"
          :key="k"
          class="tslot"
          :style="{
            background: i === 0 ? 'rgba(201,168,76,.12)' : 'rgba(255,255,255,.03)',
            border: '1px solid ' + (i === 0 ? 'rgba(201,168,76,.3)' : 'var(--color-border)'),
          }"
        >
          <div class="ts-t" :style="{ color: i === 0 ? 'var(--color-gold)' : '#9a92a8' }">
            #{{ i + 1 }} {{ slotDisplayTime(k) }}
          </div>
          <div class="ts-c">{{ dat.total }} Raider{{ dat.tent > 0 ? ` (${dat.tent} vielleicht)` : '' }}</div>
          <div v-if="isRaidReady(playersForCell(k.substring(0, k.indexOf('_')), k.substring(k.indexOf('_') + 1))).ready" class="badge-rr" style="margin-top:4px">Raid-Ready!</div>
        </div>
      </div>
    </div>

    <!-- Tooltip -->
    <Teleport to="body">
      <div
        ref="tooltipRef"
        id="htooltip"
        :class="[tooltipVisible ? 'show' : '', tooltipArrowClass]"
        :style="{ ...tooltipStyle, '--arrow-left': tooltipArrowLeft }"
        v-html="tooltipHtml"
      ></div>
    </Teleport>
  </div>
</template>

<style scoped>
.heat-toggle {
  display: flex;
  gap: 6px;
  justify-content: center;
  margin-bottom: 14px;
}

.ht-btn {
  padding: 7px 16px;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background: none;
  color: var(--color-tx3);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.ht-btn.active {
  background: rgba(201, 168, 76, 0.15);
  border-color: rgba(201, 168, 76, 0.4);
  color: var(--color-gold);
  font-weight: 600;
}

.center {
  text-align: center;
}

.sec-l {
  font-family: var(--font-heading);
  font-size: 14px;
  font-weight: 700;
  color: var(--color-tx2);
  margin-bottom: 10px;
}

.htable {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.htable th {
  padding: 4px 2px;
  font-size: 10px;
  color: var(--color-tx4);
  font-weight: 600;
  text-align: center;
  white-space: nowrap;
}

.htable td {
  padding: 2px;
}

.dl {
  font-size: 11px;
  color: var(--color-tx3);
  white-space: nowrap;
  padding-right: 6px !important;
  text-align: right;
}

.hcell {
  border-radius: 5px;
  padding: 4px 2px;
  text-align: center;
  font-weight: 700;
  font-size: 13px;
  min-width: 36px;
  cursor: default;
  position: relative;
  transition: transform 0.1s;
}

.hcell:hover {
  transform: scale(1.08);
  z-index: 2;
}

.hcell.raid-ready {
  outline: 2px solid var(--color-green, #66bb6a);
  outline-offset: -1px;
}

.hcell-roles {
  font-size: 9px;
  font-weight: 600;
  display: flex;
  justify-content: center;
  gap: 3px;
  margin-top: 2px;
}

.top-slots {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
}

.tslot {
  padding: 12px 16px;
  border-radius: 10px;
  text-align: center;
  min-width: 140px;
}

.ts-t {
  font-weight: 700;
  font-size: 13px;
  margin-bottom: 4px;
}

.ts-c {
  font-size: 12px;
  color: var(--color-tx3);
}

.badge-rr {
  display: inline-block;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(102, 187, 106, 0.15);
  color: var(--color-green, #66bb6a);
}
</style>

<style>
/* Tooltip styles - global since teleported to body */
#htooltip {
  position: fixed;
  background: #1e1b2e;
  border: 1px solid rgba(201, 168, 76, 0.3);
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 12px;
  color: var(--color-tx2, #ccc);
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.12s;
  z-index: 1000;
  max-width: 240px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}

#htooltip.show {
  opacity: 1;
}
</style>
