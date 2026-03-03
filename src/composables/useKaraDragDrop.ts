import { ref } from 'vue'
import type { KaraGroupPlayer, KaraLink } from './useKaraPersistence'

export function useKaraDragDrop() {
  const dragEntryId = ref<string | null>(null)
  const dragOverTarget = ref<string | null>(null)

  function onDragStart(entryId: string, event: DragEvent) {
    dragEntryId.value = entryId
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', entryId)
    }
  }

  function onDragEnd() {
    dragEntryId.value = null
    dragOverTarget.value = null
  }

  function onDragOver(target: string, event: DragEvent) {
    event.preventDefault()
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move'
    }
    dragOverTarget.value = target
  }

  function onDragLeave(target: string, event: DragEvent) {
    const zone = (event.currentTarget as HTMLElement)
    if (!zone.contains(event.relatedTarget as Node)) {
      if (dragOverTarget.value === target) {
        dragOverTarget.value = null
      }
    }
  }

  function onDrop(
    target: string,
    event: DragEvent,
    groups: KaraGroupPlayer[][],
    links: KaraLink[],
    onMoved: () => void,
    toast: (msg: string) => void,
  ) {
    event.preventDefault()
    dragOverTarget.value = null
    const entryId = event.dataTransfer?.getData('text/plain')
    if (!entryId) return
    moveEntry(entryId, target, groups, links, onMoved, toast)
  }

  function moveEntry(
    entryId: string,
    target: string,
    groups: KaraGroupPlayer[][],
    links: KaraLink[],
    onMoved: () => void,
    toast: (msg: string) => void,
  ) {
    // Remove from current location
    groups.forEach((g, gi) => {
      groups[gi] = g.filter(p => p.entryId !== entryId)
    })

    if (target === 'pool') {
      // Just removed from groups
    } else if (target.startsWith('group-')) {
      const gi = parseInt(target.split('-')[1])
      if (groups[gi].length >= 10) {
        toast('Gruppe ist voll (10/10)')
        onMoved()
        return
      }
      groups[gi].push({ entryId, pinned: false })

      // Move linked players together
      const link = links.find(l => l.ids.includes(entryId))
      if (link) {
        link.ids.forEach(lid => {
          if (lid === entryId) return
          let alreadyInTarget = false
          groups.forEach((g, gj) => {
            const idx = g.findIndex(p => p.entryId === lid)
            if (idx >= 0) {
              if (gj === gi) { alreadyInTarget = true; return }
              g.splice(idx, 1)
            }
          })
          if (!alreadyInTarget && groups[gi].length < 10) {
            groups[gi].push({ entryId: lid, pinned: false })
          }
        })
      }
    }
    onMoved()
  }

  function togglePin(entryId: string, groups: KaraGroupPlayer[][], onMoved: () => void) {
    groups.forEach(g => {
      g.forEach(p => {
        if (p.entryId === entryId) p.pinned = !p.pinned
      })
    })
    onMoved()
  }

  return {
    dragEntryId,
    dragOverTarget,
    onDragStart,
    onDragEnd,
    onDragOver,
    onDragLeave,
    onDrop,
    moveEntry,
    togglePin,
  }
}
