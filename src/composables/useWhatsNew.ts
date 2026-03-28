import { ref, computed } from 'vue'
import { WHATS_NEW_FEATURES, type WhatsNewFeature } from '@/lib/whatsNewFeatures'

const STORAGE_KEY = 'whats-new-seen'

function readSeenIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as string[]
  } catch {
    return []
  }
}

function writeSeenIds(ids: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  } catch { /* ignore */ }
}

export function useWhatsNew() {
  const seenIds = ref<string[]>(readSeenIds())

  const unseenFeatures = computed<WhatsNewFeature[]>(() =>
    WHATS_NEW_FEATURES
      .filter(f => !seenIds.value.includes(f.id))
      .sort((a, b) => b.addedAt.localeCompare(a.addedAt))
  )

  function dismiss(featureId: string) {
    if (!seenIds.value.includes(featureId)) {
      seenIds.value.push(featureId)
      writeSeenIds(seenIds.value)
    }
  }

  function dismissAll() {
    const allIds = WHATS_NEW_FEATURES.map(f => f.id)
    seenIds.value = allIds
    writeSeenIds(allIds)
  }

  return { unseenFeatures, dismiss, dismissAll }
}
