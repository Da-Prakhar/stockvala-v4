import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Shield, FileText, AlertTriangle, Scale } from 'lucide-react';
import axios from 'axios';
import { useCompanyStore } from '../store/companyStore';
import { API_URL } from '../utils/domainConfig';

const apiBase = API_URL.replace(/\/api\/?$/, '');

const PAGE_ICONS = {
  terms: FileText,
  privacy: Shield,
  'risk-disclosure': AlertTriangle,
  compliance: Scale,
};

const PAGE_GRADIENTS = {
  terms: 'from-blue-500 to-indigo-600',
  privacy: 'from-emerald-500 to-teal-600',
  'risk-disclosure': 'from-amber-500 to-orange-600',
  compliance: 'from-purple-500 to-violet-600',
};

function getDefaultContent(slug, companyName) {
  const defaults = {
    terms: {
      title: 'Terms & Conditions',
      lastUpdated: new Date().toISOString(),
      sections: [
        { heading: '1. Acceptance of Terms', body: `By accessing and using the ${companyName} platform, you agree to be bound by these Terms and Conditions. If you do not agree to these terms, please do not use our services.` },
        { heading: '2. Account Registration', body: 'You must provide accurate and complete information when creating an account. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must be at least 18 years old to use our services.' },
        { heading: '3. Trading Risks', body: 'Trading in financial instruments involves substantial risk of loss and is not suitable for all investors. Past performance is not indicative of future results. You should carefully consider whether trading is suitable for you in light of your financial condition. You acknowledge that you are solely responsible for your trading decisions.' },
        { heading: '4. Copy Trading Disclaimer', body: 'Copy trading allows you to replicate trades of other traders. However, past performance of any master trader is not a guarantee of future performance. You should set appropriate risk limits and monitor your copy trading positions regularly.' },
        { heading: '5. Deposits and Withdrawals', body: 'All deposit and withdrawal requests are subject to verification. We reserve the right to request additional documentation for KYC/AML compliance. Processing times may vary depending on the payment method selected.' },
        { heading: '6. Prohibited Activities', body: 'You agree not to use our platform for any illegal activities, money laundering, terrorist financing, or any activity that violates applicable laws and regulations. We reserve the right to suspend or terminate accounts that engage in prohibited activities.' },
        { heading: '7. Limitation of Liability', body: `${companyName} shall not be liable for any direct, indirect, incidental, consequential, or exemplary damages arising from your use of the platform, including but not limited to trading losses, system outages, or unauthorized access to your account.` },
        { heading: '8. Modifications', body: 'We reserve the right to modify these terms at any time. Changes will be effective immediately upon posting. Your continued use of the platform after any changes constitutes acceptance of the modified terms.' },
        { heading: '9. Contact', body: `For questions about these terms, please contact our support team through the Support page.` },
      ]
    },
    privacy: {
      title: 'Privacy Policy',
      lastUpdated: new Date().toISOString(),
      sections: [
        { heading: '1. Information We Collect', body: 'We collect personal information you provide during registration, including your name, email address, phone number, and identification documents for KYC verification. We also collect trading activity data, device information, and usage analytics.' },
        { heading: '2. How We Use Your Information', body: 'Your information is used to provide and improve our services, process transactions, verify your identity, comply with legal obligations, prevent fraud, and communicate with you about your account and platform updates.' },
        { heading: '3. Data Security', body: 'We implement industry-standard security measures to protect your personal and financial data, including encryption, secure servers, and access controls. However, no method of transmission over the internet is 100% secure.' },
        { heading: '4. Data Sharing', body: 'We do not sell your personal information to third parties. We may share your data with payment processors, regulatory authorities as required by law, and service providers who assist in operating our platform under strict confidentiality agreements.' },
        { heading: '5. KYC Documents', body: 'Identity documents submitted for KYC verification are stored securely and used solely for compliance purposes. Documents are retained as required by applicable regulations and deleted when no longer needed.' },
        { heading: '6. Cookies', body: 'We use cookies and similar technologies to maintain your session, remember your preferences, and improve our services. You can control cookie settings through your browser preferences.' },
        { heading: '7. Your Rights', body: 'You have the right to access, correct, or delete your personal data. You may request a copy of the data we hold about you. To exercise these rights, contact our support team.' },
        { heading: '8. Data Retention', body: 'We retain your personal data for as long as your account is active and as required by applicable laws. Trading records may be retained for a minimum of 5 years as required by financial regulations.' },
        { heading: '9. Contact', body: `For privacy-related inquiries, please contact us through the Support page.` },
      ]
    },
    'risk-disclosure': {
      title: 'Risk Disclosure',
      lastUpdated: new Date().toISOString(),
      sections: [
        { heading: '1. General Risk Warning', body: 'Trading in Forex, Commodities (MCX), and Stock Markets (NSE) involves significant risk and may not be suitable for all investors. The high degree of leverage can work against you as well as for you. Before deciding to trade, you should carefully consider your investment objectives, level of experience, and risk appetite.' },
        { heading: '2. Market Risk', body: 'Financial markets are subject to periods of high volatility and price fluctuations. Past performance is not indicative of future results. The value of your investments can go down as well as up, and you may lose more than your initial deposit.' },
        { heading: '3. Leverage Risk', body: 'Trading with leverage means that you can control a large position with a relatively small amount of capital. While leverage can amplify profits, it can equally amplify losses. You could lose all of your invested capital.' },
        { heading: '4. Technology Risk', body: 'Electronic trading systems, including MetaTrader 5, are subject to risks including system failure, internet connectivity issues, and software errors. These risks could result in delayed execution, incorrect fills, or inability to access your account.' },
        { heading: '5. Copy Trading Risk', body: 'Copy trading does not guarantee profits. The performance of master traders may not continue in the future. You should monitor your positions regularly and set appropriate stop-loss levels.' },
        { heading: '6. Regulatory Risk', body: 'Changes in laws and regulations may affect the availability of trading instruments, leverage levels, and the overall operation of the platform.' },
        { heading: '7. No Guaranteed Returns', body: `${companyName} does not guarantee any returns on your investments. All trading decisions are made at your own risk. You should never invest money that you cannot afford to lose.` },
      ]
    },
    compliance: {
      title: 'Compliance',
      lastUpdated: new Date().toISOString(),
      sections: [
        { heading: '1. Anti-Money Laundering (AML)', body: `${companyName} is committed to preventing money laundering and terrorist financing. We maintain strict AML policies and procedures in accordance with applicable laws and regulations.` },
        { heading: '2. Know Your Customer (KYC)', body: 'All clients are required to complete KYC verification before trading. This includes providing valid government-issued identification, proof of address, and in some cases, proof of source of funds.' },
        { heading: '3. Sanctions Compliance', body: 'We comply with all applicable international sanctions regimes. We screen all clients against relevant sanctions lists and do not provide services to sanctioned individuals or entities.' },
        { heading: '4. Data Protection', body: 'We comply with applicable data protection laws. Your personal information is collected, processed, and stored in accordance with our Privacy Policy.' },
        { heading: '5. Reporting Obligations', body: 'We report suspicious transactions to relevant authorities as required by law. We maintain records of all transactions for the periods required by applicable regulations.' },
        { heading: '6. Client Fund Protection', body: 'Client funds are held in segregated accounts separate from company funds. This ensures that your funds are protected in the event of company insolvency.' },
        { heading: '7. Complaint Handling', body: 'We have a formal complaints procedure. If you have a complaint, please contact our support team. We aim to acknowledge complaints within 24 hours and resolve them within 5 business days.' },
      ]
    },
  };
  return defaults[slug] || null;
}

export default function LegalPage() {
  const { slug } = useParams();
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const { companyName } = useCompanyStore();

  useEffect(() => {
    window.scrollTo(0, 0);
    setLoading(true);
    const fetchPage = async () => {
      try {
        const res = await axios.get(`${apiBase}/api/public/pages/${slug}`);
        const data = res.data?.data || res.data;
        if (data && data.sections && data.sections.length > 0) {
          setPage(data);
        } else {
          // API returned empty data, use defaults
          setPage(getDefaultContent(slug, companyName));
        }
      } catch (err) {
        // API not available, use built-in defaults
        console.warn('Using default page content for:', slug);
        setPage(getDefaultContent(slug, companyName));
      } finally {
        setLoading(false);
      }
    };
    fetchPage();
  }, [slug, companyName]);

  const Icon = PAGE_ICONS[slug] || FileText;
  const gradient = PAGE_GRADIENTS[slug] || 'from-blue-500 to-indigo-600';

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.2 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!page) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Page Not Found</h1>
          <Link to="/" className="text-primary-400 hover:text-primary-300">Go back home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-950 pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <motion.div
        className="max-w-4xl mx-auto"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Back button */}
        <motion.div variants={itemVariants}>
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-primary-400 transition-colors text-sm font-medium mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </motion.div>

        {/* Header Banner */}
        <motion.div
          variants={itemVariants}
          className={`bg-gradient-to-r ${gradient} rounded-2xl p-8 md:p-12 mb-10 relative overflow-hidden`}
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative z-10 flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Icon className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-white">{page.title}</h1>
              {page.lastUpdated && (
                <p className="text-white/70 text-sm mt-1">
                  Last updated: {new Date(page.lastUpdated).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </p>
              )}
            </div>
          </div>
        </motion.div>

        {/* Content Sections */}
        <div className="space-y-6">
          {page.sections?.map((section, i) => (
            <motion.div
              key={i}
              variants={itemVariants}
              className="bg-dark-800/50 backdrop-blur-sm border border-dark-700/50 rounded-xl p-6 md:p-8 hover:border-primary-500/20 transition-colors"
            >
              <h2 className="text-lg font-semibold text-white mb-3">{section.heading}</h2>
              <p className="text-gray-400 text-sm leading-relaxed">{section.body}</p>
            </motion.div>
          ))}
        </div>

        {/* Bottom CTA */}
        <motion.div variants={itemVariants} className="mt-12 text-center">
          <p className="text-gray-500 text-sm">
            Have questions? <Link to="/login" className="text-primary-400 hover:text-primary-300">Contact our support team</Link>
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
