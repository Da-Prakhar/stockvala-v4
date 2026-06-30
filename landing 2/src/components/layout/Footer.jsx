import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, Facebook, Twitter, Linkedin, Instagram } from 'lucide-react';
import { useCompanyStore, getUploadUrl } from '../../store/companyStore';

export default function Footer() {
  const {
    companyName,
    logoUrl,
    email,
    phone,
    address,
    facebook,
    twitter,
    linkedin,
    instagram,
    disclaimer,
  } = useCompanyStore();

  const platformLinks = [
    { name: 'MT5 Desktop', href: '/#platforms' },
    { name: 'Web Trader', href: '/#platforms' },
    { name: 'Mobile App', href: '/#platforms' },
    { name: 'Copy Trading', href: '/#copy-trading' },
  ];

  const tradingLinks = [
    { name: 'Forex', href: '/#features' },
    { name: 'Commodities', href: '/#features' },
    { name: 'Indices', href: '/#features' },
    { name: 'Stocks', href: '/#features' },
  ];

  const legalLinks = [
    { name: 'Terms of Service', to: '/legal/terms' },
    { name: 'Privacy Policy', to: '/legal/privacy' },
    { name: 'Risk Disclosure', to: '/legal/risk-disclosure' },
    { name: 'Compliance', to: '/legal/compliance' },
  ];

  const socialLinks = [
    { icon: Facebook, href: facebook, label: 'Facebook' },
    { icon: Twitter, href: twitter, label: 'Twitter' },
    { icon: Linkedin, href: linkedin, label: 'LinkedIn' },
    { icon: Instagram, href: instagram, label: 'Instagram' },
  ].filter((s) => s.href);

  return (
    <footer id="footer" className="bg-gray-50 dark:bg-dark-900 border-t border-gray-200 dark:border-white/[0.06] pt-16 pb-8 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-primary-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-secondary-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 mb-12">
          {/* Company info */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              {logoUrl ? (
                <img src={getUploadUrl(logoUrl)} alt="Logo" className="h-9 object-contain" />
              ) : (
                <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-sm">{companyName.substring(0, 2).toUpperCase()}</span>
                </div>
              )}
              <span className="text-lg font-bold text-gray-900 dark:text-white truncate max-w-[150px]">{companyName}</span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-5">
              Trade smarter and faster with {companyName}. Access global markets with competitive spreads, advanced platforms, and professional support.
            </p>
            <div className="space-y-2.5">
              {email && (
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-primary-500 flex-shrink-0" />
                  <a href={`mailto:${email}`} className="text-sm text-gray-500 dark:text-gray-400 hover:text-primary-500 dark:hover:text-white transition-colors">{email}</a>
                </div>
              )}
              {phone && (
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-primary-500 flex-shrink-0" />
                  <a href={`tel:${phone.replace(/[\s()-]/g, '')}`} className="text-sm text-gray-500 dark:text-gray-400 hover:text-primary-500 dark:hover:text-white transition-colors">{phone}</a>
                </div>
              )}
              {address && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-primary-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-gray-500 dark:text-gray-400">{address}</span>
                </div>
              )}
            </div>
            {/* Social icons */}
            {socialLinks.length > 0 && (
              <div className="flex gap-2 mt-5">
                {socialLinks.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    className="w-9 h-9 rounded-lg border border-gray-200 dark:border-dark-700 flex items-center justify-center text-gray-400 hover:text-primary-500 dark:hover:text-white hover:border-primary-500 transition-all"
                  >
                    <s.icon className="w-4 h-4" />
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Platform links */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-4">Platform</h4>
            <ul className="space-y-2.5">
              {platformLinks.map((link) => (
                <li key={link.name}>
                  <a href={link.href} className="text-sm text-gray-500 dark:text-gray-400 hover:text-primary-500 dark:hover:text-white transition-colors">{link.name}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Trading links */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-4">Trading</h4>
            <ul className="space-y-2.5">
              {tradingLinks.map((link) => (
                <li key={link.name}>
                  <a href={link.href} className="text-sm text-gray-500 dark:text-gray-400 hover:text-primary-500 dark:hover:text-white transition-colors">{link.name}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal links */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-4">Legal</h4>
            <ul className="space-y-2.5">
              {legalLinks.map((link) => (
                <li key={link.name}>
                  <Link to={link.to} className="text-sm text-gray-500 dark:text-gray-400 hover:text-primary-500 dark:hover:text-white transition-colors">{link.name}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-primary-500/30 to-transparent mb-6" />

        {/* Bottom row */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <p className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
            &copy; {new Date().getFullYear()} {companyName}. All rights reserved. Licensed and regulated.
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed md:text-right max-w-lg">
            {disclaimer || 'CFD trading involves substantial risk of loss. 75–90% of retail investors lose money. Trade only with capital you can afford to lose.'}
          </p>
        </div>
      </div>
    </footer>
  );
}
