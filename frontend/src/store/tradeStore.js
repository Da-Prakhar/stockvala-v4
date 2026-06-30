import { create } from 'zustand'
import api from '../utils/api'
import { useAccountStore } from './accountStore'
import { API_URL } from '../utils/domainConfig'

const API_BASE = API_URL

/** Helper: make authenticated fetch call (avoids Axios cyclic ref issues) */
const authFetch = async (url, method = 'GET', body = null) => {
  const token = localStorage.getItem('authToken')
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(`${API_BASE}${url}`, opts)
  const json = await res.json()
  if (!res.ok) throw new Error(json.message || `Request failed (${res.status})`)
  return json
}

export const useTradeStore = create((set, get) => ({
  positions: [],
  orders: [],
  tradeHistory: [],
  isLoading: false,
  positionsLoading: false,   // separate flag — only true on FIRST positions load
  error: null,

  /**
   * Fetch live positions from MT5 for the selected account.
   * NEVER clears existing positions on error — stale data beats blank screen.
   */
  fetchLivePositions: async () => {
    const accountState = useAccountStore.getState()
    const selectedId = accountState.selectedAccountId
    if (!selectedId) return []

    // Only show spinner when we have nothing to display yet
    const hasData = get().positions.length > 0
    if (!hasData) set({ positionsLoading: true })
    try {
      const data = await accountState.fetchAccountPositions(selectedId)
      const rawPositions = data.positions || data || []
      const positions = (Array.isArray(rawPositions) ? rawPositions : []).map((pos) => ({
        id: pos.ticket || pos.position || String(Date.now() + Math.random()),
        symbol: pos.symbol || '',
        type: pos.type === 0 || pos.type === 'BUY' ? 'buy' : pos.type === 1 || pos.type === 'SELL' ? 'sell' : String(pos.type || '').toLowerCase(),
        volume: pos.volume || 0,
        openPrice: pos.price_open || pos.priceOpen || 0,
        currentPrice: pos.price_current || pos.priceCurrent || 0,
        pnl: pos.profit || 0,
        sl: pos.sl || 0,
        tp: pos.tp || 0,
        openTime: pos.time_create || pos.timeCreate || new Date().toISOString(),
        swap: pos.swap || 0,
        commission: pos.commission || 0,
      }))
      set({ positions, positionsLoading: false })
      return positions
    } catch (error) {
      console.error('Fetch live positions error:', error.message)
      // DO NOT clear positions — keep the last known data visible
      set({ error: error.message, positionsLoading: false })
      return get().positions
    }
  },

  /**
   * Fetch positions from backend via MT5.
   * NEVER clears existing positions on error — stale data beats blank screen.
   * @param {string|number} accountId - Optional: filter by specific account for isolation
   */
  fetchPositions: async (accountId = null) => {
    // Only show spinner when we have nothing to display yet
    const hasData = get().positions.length > 0
    if (!hasData) set({ positionsLoading: true })
    try {
      const url = accountId ? `/trades/positions?accountId=${accountId}` : '/trades/positions'
      const response = await api.get(url)
      const data = response.data?.data || {}
      const positions = (data.positions || []).map((pos) => ({
        id: pos.ticket || String(Date.now() + Math.random()),
        tradeId: pos.tradeId || null,
        symbol: pos.symbol || '',
        type: pos.type || 'buy',
        volume: pos.volume || 0,
        openPrice: pos.openPrice || 0,
        currentPrice: pos.currentPrice || 0,
        pnl: pos.profit || 0,
        sl: pos.sl || 0,
        tp: pos.tp || 0,
        openTime: pos.openTime || null,
        swap: pos.swap || 0,
        mt5Login: pos.mt5Login,
        accountId: pos.accountId,
      }))
      set({ positions, positionsLoading: false })
      return positions
    } catch (error) {
      console.error('Fetch positions error:', error.message)
      // DO NOT clear positions — keep the last known data visible
      set({ error: error.message, positionsLoading: false })
      return get().positions
    }
  },

  /**
   * Fetch pending orders from MT5 via backend
   * @param {string|number} accountId - Optional: filter by specific account
   */
  fetchOrders: async (accountId = null) => {
    set({ isLoading: true, error: null })
    try {
      const url = accountId ? `/trades/orders?accountId=${accountId}` : '/trades/orders'
      const response = await api.get(url)
      const data = response.data?.data || {}
      const orders = (data.orders || data || []).map((ord) => ({
        id: ord.ticket || ord.id || String(Date.now() + Math.random()),
        symbol: ord.symbol || '',
        type: ord.type || 'unknown',
        volume: ord.volume || 0,
        price: ord.price || 0,
        sl: ord.sl || 0,
        tp: ord.tp || 0,
        status: ord.status || 'active',
        mt5Login: ord.mt5Login,
      }))
      set({ orders, isLoading: false })
      return orders
    } catch (error) {
      console.error('Fetch orders error:', error.message)
      set({ error: error.message, isLoading: false })
      return get().orders
    }
  },

  /**
   * Fetch trade/deal history from MT5 via backend
   * @param {number} page
   * @param {number} limit
   * @param {string|number} accountId - Optional: filter by specific account
   */
  fetchTradeHistory: async (page = 1, limit = 50, accountId = null) => {
    set({ isLoading: true, error: null })
    try {
      let url = `/trades/history?page=${page}&limit=${limit}`
      if (accountId) url += `&accountId=${accountId}`
      const response = await api.get(url)
      const data = response.data?.data || {}
      const tradeHistory = (data.trades || []).map((deal) => ({
        id: deal.ticket || String(Date.now() + Math.random()),
        symbol: deal.symbol || '',
        type: deal.type || '',
        volume: deal.volume || 0,
        price: deal.price || 0,
        profit: deal.profit || 0,
        swap: deal.swap || 0,
        commission: deal.commission || 0,
        time: deal.time || null,
        mt5Login: deal.mt5Login,
      }))
      set({ tradeHistory, isLoading: false })
      return { trades: tradeHistory, total: data.total || 0 }
    } catch (error) {
      console.error('Fetch trade history error:', error.message)
      set({ error: error.message, isLoading: false })
      return { trades: get().tradeHistory, total: 0 }
    }
  },

  /**
   * Place a new order via API
   */
  placeOrder: async (orderData) => {
    set({ isLoading: true, error: null })
    try {
      const json = await authFetch('/trades/place-order', 'POST', orderData)
      const trade = json.data || json
      set({ isLoading: false })
      return trade
    } catch (error) {
      const errorMessage = error.message || 'Failed to place order'
      console.error('Place order error:', errorMessage)
      set({ error: errorMessage, isLoading: false })
      throw new Error(errorMessage)
    }
  },

  /**
   * Close a trade via API
   * @param {number|string} ticket - Position ticket number
   * @param {object} bodyData - { mt5Login, mt5AccountId } to identify the account
   */
  closeTrade: async (tradeIdOrTicket, bodyData = {}) => {
    set({ isLoading: true, error: null })
    try {
      await authFetch(`/trades/close/${tradeIdOrTicket}`, 'POST', bodyData)
      set((state) => ({
        positions: state.positions.filter((pos) =>
          pos.id !== tradeIdOrTicket &&
          pos.id !== String(tradeIdOrTicket) &&
          pos.tradeId !== tradeIdOrTicket &&
          pos.tradeId !== Number(tradeIdOrTicket)
        ),
        isLoading: false,
      }))
      return true
    } catch (error) {
      const errorMessage = error.message || 'Failed to close trade'
      console.error('Close trade error:', errorMessage)
      set({ error: errorMessage, isLoading: false })
      throw new Error(errorMessage)
    }
  },

  // Local mutations
  addPosition: (position) => set((state) => ({ positions: [...state.positions, position] })),
  updatePosition: (positionId, updates) => set((state) => ({
    positions: state.positions.map((pos) => pos.id === positionId ? { ...pos, ...updates } : pos)
  })),
  closePosition: (positionId) => set((state) => ({
    positions: state.positions.filter((pos) => pos.id !== positionId)
  })),
  addOrder: (order) => set((state) => ({ orders: [...state.orders, order] })),
  cancelOrder: (orderId) => set((state) => ({
    orders: state.orders.filter((ord) => ord.id !== orderId)
  })),
}))
