import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { DkpBalance, DkpTransaction, DkpConfig } from '@/types'
import { api } from '@/lib/api'

const DKP_API = '/api/dkp'

export const useDkpStore = defineStore('dkp', () => {
  const balances = ref<DkpBalance[]>([])
  const transactions = ref<DkpTransaction[]>([])
  const config = ref<DkpConfig>({
    roles: {},
    defaultDecayPercent: 15,
    maxDkpAmount: 10000,
    allowNegativeBalance: true,
    startingBalance: 0,
    transactionLimit: 50,
    reasonMaxLength: 200,
  })
  const loading = ref(false)

  const sortedBalances = computed(() => {
    return [...balances.value].sort((a, b) => b.balance - a.balance)
  })

  function playerTransactions(name: string) {
    return transactions.value.filter(t => t.playerName === name)
  }

  async function load() {
    loading.value = true
    try {
      const data = await api.get<{ balances: DkpBalance[]; transactions: DkpTransaction[]; config?: DkpConfig }>(DKP_API)
      balances.value = data.balances || []
      transactions.value = data.transactions || []
      if (data.config) config.value = data.config
    } catch (err) {
      console.error('Failed to load DKP:', err)
    } finally {
      loading.value = false
    }
  }

  async function award(players: { name: string; className: string }[], amount: number, reason: string) {
    await api.post(DKP_API, { action: 'award', players, amount, reason })
    await load()
  }

  async function spend(playerName: string, amount: number, reason: string) {
    await api.post(DKP_API, { action: 'spend', playerName, amount, reason })
    await load()
  }

  async function decay(percent: number) {
    await api.post(DKP_API, { action: 'decay', percent })
    await load()
  }

  async function undo(transactionId: string) {
    await api.post(DKP_API, { action: 'undo', transactionId })
    await load()
  }

  async function editTransaction(transactionId: string, amount: number, reason: string) {
    await api.post(DKP_API, { action: 'edit-transaction', transactionId, amount, reason })
    await load()
  }

  async function deleteTransaction(transactionId: string) {
    await api.post(DKP_API, { action: 'delete-transaction', transactionId })
    await load()
  }

  async function adjustBalance(playerName: string, newBalance: number, reason: string) {
    await api.post(DKP_API, { action: 'adjust-balance', playerName, newBalance, reason })
    await load()
  }

  async function editPlayer(playerName: string, className: string) {
    await api.post(DKP_API, { action: 'edit-player', playerName, className })
    await load()
  }

  async function deletePlayer(playerName: string) {
    await api.post(DKP_API, { action: 'delete-player', playerName })
    await load()
  }

  async function saveConfig(newConfig: Partial<DkpConfig>) {
    await api.post(DKP_API, { action: 'save-config', ...newConfig })
    await load()
  }

  async function manageRoles(action: 'add' | 'remove', username: string, role: 'admin' | 'officer') {
    await api.post(DKP_API, { action: 'manage-roles', roleAction: action, username, role })
    await load()
  }

  return {
    balances, transactions, config, loading,
    sortedBalances, playerTransactions,
    load, award, spend, decay, undo,
    editTransaction, deleteTransaction,
    adjustBalance, editPlayer, deletePlayer,
    saveConfig, manageRoles,
  }
})
