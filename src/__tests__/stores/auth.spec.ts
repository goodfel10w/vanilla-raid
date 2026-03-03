import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'

describe('Auth Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('starts with no user', () => {
    const store = useAuthStore()
    expect(store.user).toBeNull()
    expect(store.isLoggedIn).toBe(false)
    expect(store.isAdmin).toBe(false)
  })

  it('saves session to localStorage', () => {
    const store = useAuthStore()
    store.saveSession({ token: 'test', username: 'player1', userId: 'u1' })
    expect(store.isLoggedIn).toBe(true)
    expect(localStorage.getItem('raid-auth')).toBeTruthy()
  })

  it('restores session from localStorage', () => {
    localStorage.setItem('raid-auth', JSON.stringify({ token: 'test', username: 'player1', userId: 'u1' }))
    const store = useAuthStore()
    store.restoreSession()
    expect(store.isLoggedIn).toBe(true)
    expect(store.user?.username).toBe('player1')
  })

  it('clears session', () => {
    const store = useAuthStore()
    store.saveSession({ token: 'test', username: 'player1', userId: 'u1' })
    store.clearSession()
    expect(store.isLoggedIn).toBe(false)
    expect(store.user).toBeNull()
    expect(localStorage.getItem('raid-auth')).toBeNull()
  })

  it('detects admin status', () => {
    const store = useAuthStore()
    store.saveSession({ token: 'test', username: 'admin', userId: 'u1', isAdmin: true })
    expect(store.isAdmin).toBe(true)
  })
})
