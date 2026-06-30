import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import Button from '../ui/Button';
import ThemeToggle from '../ui/ThemeToggle';
import { useCompanyStore, getUploadUrl } from '../../store/companyStore';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const location = useLocation();
  const { companyName, logoUrl } = useCompanyStore();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close menu on route change
  useEffect(() => { setIsOpen(false); }, [location]);

  // Lock body scroll when menu is open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'Trading', path: '/#features' },
    { name: 'Accounts', path: '/#accounts' },
    { name: 'About', path: '/#copy-trading' },
    { name: 'Contact', path: '/#footer' },
  ];

  const isActive = (path) => path === '/' ? location.pathname === '/' : false;

  return (
    <>
      <motion.nav
        className={`fixed top-0 w-full z-40 transition-all duration-300 ${
          isScrolled
            ? 'bg-white/90 dark:bg-dark-950/90 backdrop-blur-xl border-b border-gray-200 dark:border-primary-500/10 shadow-sm dark:shadow-none'
            : 'bg-transparent'
        }`}
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 flex-shrink-0">
              {logoUrl ? (
                <img src={getUploadUrl(logoUrl)} alt="Logo" className="h-9 object-contain" />
              ) : (
                <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-sm">{companyName.substring(0, 2).toUpperCase()}</span>
                </div>
              )}
              <span className="text-lg font-bold text-gray-900 dark:text-white hidden sm:inline truncate max-w-[150px]">
                {companyName}
              </span>
            </Link>

            {/* Desktop nav links */}
            <div className="hidden md:flex items-center gap-6">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.path}
                  className={`text-sm font-medium transition-colors duration-200 relative group ${
                    isActive(link.path)
                      ? 'text-primary-500'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {link.name}
                  <span className="absolute -bottom-0.5 left-0 w-0 h-0.5 bg-gradient-to-r from-primary-500 to-secondary-500 group-hover:w-full transition-all duration-300 rounded-full" />
                </a>
              ))}
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <div className="hidden sm:flex items-center gap-2">
                <Link to="/login">
                  <Button variant="secondary" size="sm">Login</Button>
                </Link>
                <Link to="/register">
                  <Button variant="gradient" size="sm">Sign Up</Button>
                </Link>
              </div>
              {/* Hamburger */}
              <button
                onClick={() => setIsOpen(!isOpen)}
                aria-label="Toggle menu"
                className="md:hidden p-2 rounded-lg bg-gray-100 dark:bg-dark-800 hover:bg-gray-200 dark:hover:bg-dark-700 transition-colors"
              >
                {isOpen ? <X className="w-5 h-5 text-gray-700 dark:text-white" /> : <Menu className="w-5 h-5 text-gray-700 dark:text-white" />}
              </button>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Mobile menu — full-screen overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="fixed inset-0 z-50 bg-white dark:bg-dark-950 flex flex-col overflow-y-auto"
          >
            {/* Header row */}
            <div className="flex items-center justify-between px-6 h-16 border-b border-gray-200 dark:border-dark-700 flex-shrink-0">
              <Link to="/" className="flex items-center gap-2" onClick={() => setIsOpen(false)}>
                {logoUrl ? (
                  <img src={getUploadUrl(logoUrl)} alt="Logo" className="h-8 object-contain" />
                ) : (
                  <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-xs">{companyName.substring(0, 2).toUpperCase()}</span>
                  </div>
                )}
                <span className="text-base font-bold text-gray-900 dark:text-white truncate max-w-[130px]">{companyName}</span>
              </Link>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-lg bg-gray-100 dark:bg-dark-800 hover:bg-gray-200 dark:hover:bg-dark-700 transition-colors"
                >
                  <X className="w-5 h-5 text-gray-700 dark:text-white" />
                </button>
              </div>
            </div>

            {/* Nav links */}
            <nav className="flex-1 px-4 py-6">
              <div className="flex flex-col gap-1">
                {navLinks.map((link, i) => (
                  <motion.div
                    key={link.name}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 }}
                  >
                    <a
                      href={link.path}
                      onClick={() => setIsOpen(false)}
                      className="flex items-center px-4 py-3.5 rounded-xl text-base font-medium text-gray-700 dark:text-gray-300 hover:text-primary-500 dark:hover:text-primary-400 hover:bg-primary-500/8 dark:hover:bg-primary-500/10 transition-all"
                    >
                      {link.name}
                    </a>
                  </motion.div>
                ))}
              </div>
            </nav>

            {/* Bottom buttons */}
            <div className="px-4 pb-8 flex flex-col gap-3">
              <Link to="/login" onClick={() => setIsOpen(false)}>
                <Button variant="secondary" size="lg" className="w-full">Login</Button>
              </Link>
              <Link to="/register" onClick={() => setIsOpen(false)}>
                <Button variant="gradient" size="lg" className="w-full">Sign Up</Button>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
