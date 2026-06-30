import axios from 'axios'
import { useAuthStore } from '../store/authStore'
import { API_URL } from './domainConfig'

const API_BASE_URL = API_URL

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
})

api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token || localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    // Only set Content-Type for non-FormData requests (file uploads need multipart boundary)
    if (!(config.data instanceof FormData)) {
      config.headers['Content-Type'] = 'application/json'
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
      // Redirect to login — handle sub-path case (backend serves at /broker/*)
      const loginPath = window.location.pathname.startsWith('/broker/')
        ? '/broker/login'
        : '/login'
      window.location.href = loginPath
    }
    return Promise.reject(error)
  }
)

export default api
