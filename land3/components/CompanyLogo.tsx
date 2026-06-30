'use client';

import Image from 'next/image';
import { useCompanyStore, getUploadUrl } from '@/store/companyStore';

interface Props {
  fallbackSrc: string;
  width?: number;
  height?: number;
  className?: string;
}

export default function CompanyLogo({ fallbackSrc, width = 189, height = 27, className }: Props) {
  const { logoUrl, companyName } = useCompanyStore();
  const src = logoUrl ? getUploadUrl(logoUrl) : null;

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={companyName || 'Logo'} style={{ height, width: 'auto', objectFit: 'contain' }} className={className} />
    );
  }

  return (
    <Image src={fallbackSrc} alt={companyName || 'Logo'} width={width} height={height} priority className={className} />
  );
}
