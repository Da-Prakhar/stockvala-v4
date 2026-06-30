'use client';

import { create } from 'zustand';
import axios from 'axios';
import { getApiUrl, getUserCrmUrl } from '@/lib/domainConfig';

interface AuthState {
  user: object | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  redirectToDashboard: () => void;
}

interface RegisterData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  referralCode?: string;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await axios.post(`${getApiUrl()}/auth/login`, { email, password });
      const resData = response.data?.data || response.data;
      const { user, accessToken, refreshToken } = resData;

      localStorage.setItem('authToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('user', JSON.stringify(user));

      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error: unknown) {
      const msg = (error as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message || 'Login failed';
      set({ error: msg, isLoading: false });
      throw new Error(msg);
    }
  },

  register: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await axios.post(`${getApiUrl()}/auth/register`, {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: data.password,
        referralCode: data.referralCode || undefined,
      });
      const resData = response.data?.data || response.data;
      const { user, accessToken, refreshToken } = resData;

      localStorage.setItem('authToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('user', JSON.stringify(user));

      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error: unknown) {
      const msg = (error as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message || 'Registration failed';
      set({ error: msg, isLoading: false });
      throw new Error(msg);
    }
  },

  logout: () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    set({ user: null, isAuthenticated: false });
  },

  redirectToDashboard: () => {
    const authToken = localStorage.getItem('authToken');
    const refreshToken = localStorage.getItem('refreshToken');
    const user = localStorage.getItem('user');
    const params = new URLSearchParams();
    if (authToken) params.set('authToken', authToken);
    if (refreshToken) params.set('refreshToken', refreshToken);
    if (user) params.set('user', encodeURIComponent(user));
    window.location.href = `${getUserCrmUrl()}/auth/callback?${params.toString()}`;
  },
}));
