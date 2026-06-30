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
      const res = await axios.get(`${apiBase}/api/public/settings/company`);
      const data = res.data?.data || res.data;
      if (data) {
        set({ ...data, isLoaded: true });

        // Dynamically update document title, meta tags and favicon at runtime
        if (data.companyName) {
          document.title = `${data.companyName} - Trade Smarter. Trade Faster.`;

          const metaDesc = document.querySelector('meta[name="description"]');
          if (metaDesc) metaDesc.setAttribute('content', `${data.companyName} - Trade Smarter. Trade Faster. Access 150+ markets with tight spreads, advanced trading platforms, and professional support.`);

          const ogTitle = document.querySelector('meta[property="og:title"]');
          if (ogTitle) ogTitle.setAttribute('content', `${data.companyName} - Professional Trading Platform`);

          const ogDesc = document.querySelector('meta[property="og:description"]');
          if (ogDesc) ogDesc.setAttribute('content', `Trade Smarter. Trade Faster with ${data.companyName}. 500K+ traders trust us.`);

          const metaAuthor = document.querySelector('meta[name="author"]');
          if (metaAuthor) metaAuthor.setAttribute('content', data.companyName);
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
