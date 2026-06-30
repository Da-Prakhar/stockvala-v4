import { create } from 'zustand';
import axios from 'axios';
import { API_URL } from '../utils/domainConfig';

const apiBase = API_URL.replace(/\/api\/?$/, '');

// Helper to get full URL for uploads
export function getUploadUrl(v) {
  if (!v) return null;
  if (v.startsWith('http')) return v;
  const uploadsIdx = v.indexOf('uploads/');
  const relativePath = uploadsIdx >= 0 ? v.substring(uploadsIdx) : v.replace(/^\//, '');
  return `${apiBase}/${relativePath}`;
}

export const useCompanyStore = create((set) => ({
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
      // Use plain axios (no auth interceptor) so this works on public pages
      const res = await axios.get(`${apiBase}/api/public/settings/company`);
      const data = res.data?.data || res.data;
      if (data) {
        set({ ...data, isLoaded: true });

        // Dynamically update document title and favicon
        if (data.companyName) {
          document.title = `${data.companyName} - Broker CRM`;
        }
        if (data.faviconUrl) {
          let link = document.querySelector("link[rel~='icon']");
          if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
          }
          link.href = getUploadUrl(data.faviconUrl);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch public company settings', err);
      set({ isLoaded: true });
    }
  }
}));
