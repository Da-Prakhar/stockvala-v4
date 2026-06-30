'use client';

import { create } from 'zustand';
import axios from 'axios';
import { getApiBase, getUploadUrl } from '@/lib/domainConfig';

interface CompanyState {
  companyName: string;
  email: string;
  phone: string;
  address: string;
  facebook: string;
  twitter: string;
  linkedin: string;
  instagram: string;
  footerText: string;
  disclaimer: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  isLoaded: boolean;
  fetchCompanySettings: () => Promise<void>;
}

export const useCompanyStore = create<CompanyState>((set) => ({
  companyName: '',
  email: '',
  phone: '',
  address: '',
  facebook: '',
  twitter: '',
  linkedin: '',
  instagram: '',
  footerText: '',
  disclaimer: '',
  logoUrl: null,
  faviconUrl: null,
  isLoaded: false,

  fetchCompanySettings: async () => {
    try {
      const apiBase = getApiBase();
      const res = await axios.get(`${apiBase}/api/public/settings/company`);
      const data = res.data?.data || res.data;
      if (data) {
        set({ ...data, isLoaded: true });

        if (data.companyName) {
          document.title = `${data.companyName} - Trade Smarter. Trade Faster.`;
          const metaDesc = document.querySelector('meta[name="description"]');
          if (metaDesc) metaDesc.setAttribute('content', `${data.companyName} - Professional Trading Platform`);
        }
        if (data.faviconUrl) {
          let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
          if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
          }
          link.href = getUploadUrl(data.faviconUrl) || '';
        }
      }
    } catch (err) {
      console.warn('Failed to fetch public company settings', err);
      set({ isLoaded: true });
    }
  },
}));

export { getUploadUrl };
