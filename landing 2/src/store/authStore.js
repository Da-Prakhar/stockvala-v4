import { create } from 'zustand';
import api from '../utils/api';
import { USER_CRM_URL } from '../utils/domainConfig';

export const useAuthStore = create((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/auth/login', { email, password });
      // Backend returns { success, data: { user, accessToken, refreshToken } }
      const resData = response.data?.data || response.data;
      const { user, accessToken, refreshToken } = resData;

      // Store tokens (same keys as user-crm so auth carries over)
      localStorage.setItem('authToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('user', JSON.stringify(user));

      set({
        user,
        isAuthenticated: true,
        isLoading: false,
      });

      return { user, accessToken };
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Login failed';
      set({
        error: message,
        isLoading: false,
      });
      throw new Error(message);
    }
  },

  register: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/auth/register', {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: data.password,
        referralCode: data.referralCode || undefined,
      });
      // Backend returns { success, data: { user, accessToken, refreshToken } }
      const resData = response.data?.data || response.data;
      const { user, accessToken, refreshToken } = resData;

      // Store tokens (same keys as user-crm so auth carries over)
      localStorage.setItem('authToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('user', JSON.stringify(user));

      set({
        user,
        isAuthenticated: true,
        isLoading: false,
      });

      return { user, accessToken };
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Registration failed';
      set({
        error: message,
        isLoading: false,
      });
      throw new Error(message);
    }
  },

  logout: () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    set({
      user: null,
      isAuthenticated: false,
    });
  },

  resetError: () => set({ error: null }),

  // Helper to redirect to user CRM dashboard with token handoff
  redirectToDashboard: () => {
    const authToken = localStorage.getItem('authToken');
    const refreshToken = localStorage.getItem('refreshToken');
    const user = localStorage.getItem('user');
    // Pass tokens via URL params since localhost:3000 and localhost:3001 have separate localStorage
    const params = new URLSearchParams();
    if (authToken) params.set('authToken', authToken);
    if (refreshToken) params.set('refreshToken', refreshToken);
    if (user) params.set('user', encodeURIComponent(user));
    window.location.href = `${USER_CRM_URL}/auth/callback?${params.toString()}`;
  },
}));
