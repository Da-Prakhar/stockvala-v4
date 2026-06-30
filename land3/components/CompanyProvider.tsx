'use client';

import { useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { useCompanyStore } from '@/store/companyStore';

export default function CompanyProvider({ children }: { children: React.ReactNode }) {
  const fetchCompanySettings = useCompanyStore((s) => s.fetchCompanySettings);

  useEffect(() => {
    fetchCompanySettings();
  }, [fetchCompanySettings]);

  return (
    <>
      {children}
      <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
    </>
  );
}
