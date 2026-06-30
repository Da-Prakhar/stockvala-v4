import { useEffect } from 'react';
import HeroSection from '../components/home/HeroSection';
import FeaturesSection from '../components/home/FeaturesSection';
import AccountTypesSection from '../components/home/AccountTypesSection';
import PlatformsSection from '../components/home/PlatformsSection';
import CopyTradingSection from '../components/home/CopyTradingSection';
import StatsSection from '../components/home/StatsSection';
import CTASection from '../components/home/CTASection';

export default function HomePage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-dark-950 dark:bg-dark-950">
      <HeroSection />
      <FeaturesSection />
      <AccountTypesSection />
      <PlatformsSection />
      <CopyTradingSection />
      <StatsSection />
      <CTASection />
    </div>
  );
}
