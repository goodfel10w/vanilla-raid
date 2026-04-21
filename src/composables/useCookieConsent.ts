import { ref } from 'vue'

const STORAGE_KEY = 'cookie-notice-v1'

function readDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

const dismissed = ref(readDismissed())

export function useCookieConsent() {
  function dismiss() {
    dismissed.value = true
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch { /* Safari private mode */ }
  }

  return { dismissed, dismiss }
}
