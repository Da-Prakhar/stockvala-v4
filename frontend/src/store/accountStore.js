import { create } from 'zustand'
import api from '../utils/api'

/**
 * Account type labels and config
 */
export const ACCOUNT_TYPE_CONFIG = {
  live: { label: 'Live Trading', color: 'green', description: 'Trade with real money on live markets' },
  cent: { label: 'Cent Account', color: 'blue', description: 'Trade with micro lots — 1 lot = 0.01 standard lot' },
  demo: { label: 'Demo Account', color: 'amber', description: 'Practice trading with $10,000 virtual funds' },
  copy_trading: { label: 'Copy Trading', color: 'purple', description: 'Automatically copy trades from expert traders' },
}

/**
 * Normalize account data from backend to frontend-friendly format
 */
const normalizeAccount = (acc) => ({
  ...acc,
  login: acc.mt5Login || acc.login,
  type: acc.accountType || acc.type || 'live',
  server: acc.serverName || acc.server || '',
  balance: parseFloat(acc.balance) || 0,
  equity: parseFloat(acc.equity) || 0,
  margin: parseFloat(acc.margin) || 0,
  freeMargin: parseFloat(acc.freeMargin) || 0,
  leverage: acc.leverage || 100,
  currency: acc.currency || 'USD',
  market: acc.market || 'forex',
  status: acc.status || 'active',
})

export const useAccountStore = create((set, get) => ({
  accounts: [],
  selectedAccountId: null,
  isLoading: false,
  error: null,
  copyMasters: [],
  copyMastersLoading: false,

  setAccounts: (accounts) => set({ accounts: accounts.map(normalizeAccount) }),

  addAccount: (account) => {
    set((state) => ({
      accounts: [...state.accounts, normalizeAccount(account)],
    }))
  },

  updateAccount: (accountId, updates) => {
    set((state) => ({
      accounts: state.accounts.map((acc) =>
        acc.id === accountId ? { ...acc, ...updates } : acc
      ),
    }))
  },

  deleteAccount: (accountId) => {
    set((state) => ({
      accounts: state.accounts.filter((acc) => acc.id !== accountId),
    }))
  },

  selectAccount: (accountId) => {
    set({ selectedAccountId: accountId })
  },

  getSelectedAccount: () => {
    const state = get()
    return state.accounts.find((acc) => acc.id === state.selectedAccountId)
  },

  fetchAccounts: async () => {
    set({ isLoading: true, error: null })
    try {
      const response = await api.get('/accounts')
      const raw = response.data?.data || []
      const accounts = Array.isArray(raw) ? raw.map(normalizeAccount) : []
      const currentId = get().selectedAccountId
      const stillExists = currentId != null && accounts.some(a => String(a.id) === String(currentId))
      set({
        accounts,
        selectedAccountId: stillExists ? currentId : (accounts.length > 0 ? accounts[0].id : null),
        isLoading: false,
      })
      return accounts
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to fetch accounts'
      console.error('Fetch accounts error:', errorMessage)
      set({ error: errorMessage, isLoading: false, accounts: [] })
      return []
    }
  },

  createAccount: async (accountData) => {
    set({ isLoading: true, error: null })
    try {
      const response = await api.post('/accounts/create', accountData, { timeout: 60000 })
      const data = response.data?.data
      const newAccount = normalizeAccount(data)
      set((state) => ({
        accounts: [...state.accounts, newAccount],
        isLoading: false,
      }))
      return {
        success: true,
        account: newAccount,
        tradingPassword: data.tradingPassword,
        investorPassword: data.investorPassword,
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to create account'
      console.error('Create account error:', errorMessage)
      set({ error: errorMessage, isLoading: false })
      return { success: false, error: errorMessage }
    }
  },

  fetchAccountDetail: async (accountId) => {
    set({ isLoading: true, error: null })
    try {
      const response = await api.get(`/accounts/${accountId}`)
      const account = normalizeAccount(response.data?.data)
      set((state) => ({
        accounts: state.accounts.map((acc) =>
          acc.id === accountId ? account : acc
        ),
        isLoading: false,
      }))
      return account
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to fetch account details'
      console.error('Fetch account detail error:', errorMessage)
      set({ error: errorMessage, isLoading: false })
      return null
    }
  },

  /**
   * Fetch live positions from MT5 for a specific account
   */
  fetchAccountPositions: async (accountId) => {
    try {
      const response = await api.get(`/accounts/${accountId}/positions`)
      return response.data?.data || { positions: [], total: 0 }
    } catch (error) {
      console.error('Fetch account positions error:', error.message)
      return { positions: [], total: 0 }
    }
  },

  /**
   * Generate new trading & investor passwords for an account
   */
  changePassword: async (accountId) => {
    try {
      const response = await api.post(`/accounts/${accountId}/change-password`)
      const data = response.data?.data
      set((state) => ({
        accounts: state.accounts.map((acc) =>
          acc.id === accountId
            ? { ...acc, tradingPassword: data.tradingPassword, investorPassword: data.investorPassword }
            : acc
        ),
      }))
      return { success: true, tradingPassword: data.tradingPassword, investorPassword: data.investorPassword }
    } catch (error) {
      return { success: false, error: error.response?.data?.message || error.message }
    }
  },

  /**
   * Sync account data from MT5 (updates balance/equity)
   */
  syncAccount: async (accountId) => {
    try {
      const response = await api.post(`/accounts/${accountId}/sync`)
      const account = normalizeAccount(response.data?.data)
      set((state) => ({
        accounts: state.accounts.map((acc) =>
          acc.id === accountId ? account : acc
        ),
      }))
      return { success: true, account }
    } catch (error) {
      console.error('Sync account error:', error.message)
      return { success: false, error: error.message }
    }
  },

  /**
   * Fetch available copy trading masters for account creation
   */
  fetchCopyMasters: async () => {
    set({ copyMastersLoading: true })
    try {
      const response = await api.get('/copy-trading/masters')
      const data = response.data?.data || response.data || []
      const masters = Array.isArray(data) ? data : []
      set({ copyMasters: masters, copyMastersLoading: false })
      return masters
    } catch (error) {
      console.error('Fetch copy masters error:', error.message)
      set({ copyMasters: [], copyMastersLoading: false })
      return []
    }
  },

  setLoading: (isLoading) => set({ isLoading }),
}))
