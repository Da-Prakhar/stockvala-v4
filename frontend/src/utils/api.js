import axios from 'axios'
import { API_URL } from './domainConfig'

const API_BASE_URL = API_URL

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,   // 10s — fail fast so slow endpoints don't queue up and exhaust rate limits
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    // The instance default Content-Type is 'application/json'. Axios only
    // auto-detects FormData and lets the browser set the multipart boundary
    // when no Content-Type is already present — otherwise it silently
    // JSON-stringifies the FormData (dropping any attached files). Strip the
    // default here so uploads (KYC docs, deposit proofs, etc.) work.
    if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
      delete config.headers['Content-Type']
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // Skip refresh-token flow for auth endpoints — a 401 there means wrong
    // credentials, not an expired session. Trying to refresh would mask the
    // real error with a misleading "Session expired" message.
    const isAuthEndpoint =
      originalRequest.url?.includes('/auth/login') ||
      originalRequest.url?.includes('/auth/register') ||
      originalRequest.url?.includes('/auth/refresh-token')

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true

      try {
        const refreshToken = localStorage.getItem('refreshToken')
        const response = await axios.post(`${API_BASE_URL}/auth/refresh-token`, {
          refreshToken,
        })

        const resData = response.data?.data || response.data
        const newToken = resData.accessToken
        localStorage.setItem('authToken', newToken)

        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return api(originalRequest)
      } catch (err) {
        localStorage.removeItem('authToken')
        localStorage.removeItem('refreshToken')
        localStorage.removeItem('user')
        
        let loginPath = '/login'
        const path = window.location.pathname
        if (path.startsWith('/user/')) {
          loginPath = '/user/login'
        } else if (path.startsWith('/user-crm/')) {
          loginPath = '/user-crm/login'
        }
        window.location.href = loginPath
        return Promise.reject(new Error('Session expired'))
      }
    }

    const msg = error.response?.data?.message || error.message || 'Request failed'
    const cleanError = new Error(msg)
    cleanError.response = error.response ? {
      status: error.response.status,
      data: error.response.data,
    } : undefined
    return Promise.reject(cleanError)
  }
)

export default api
