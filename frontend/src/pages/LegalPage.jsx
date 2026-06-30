import React, { useEffect } from 'react'
import { Link, useParams, Navigate } from 'react-router-dom'
import { useCompanyStore, getUploadUrl } from '../store/companyStore'
import { ArrowLeft, FileText, Shield, AlertTriangle, CheckSquare } from 'lucide-react'

const PAGE_CONFIG = {
  terms: {
    title: 'Terms of Service',
    icon: FileText,
    color: 'blue',
  },
  privacy: {
    title: 'Privacy Policy',
    icon: Shield,
    color: 'cyan',
  },
  'risk-disclosure': {
    title: 'Risk Disclosure',
    icon: AlertTriangle,
    color: 'amber',
  },
  compliance: {
    title: 'Compliance Policy',
    icon: CheckSquare,
    color: 'green',
  },
}

const COLOR_MAP = {
  blue: { icon: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', heading: 'text-blue-400' },
  cyan: { icon: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', heading: 'text-cyan-400' },
  amber: { icon: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', heading: 'text-amber-400' },
  green: { icon: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20', heading: 'text-green-400' },
}

function Section({ title, children, colorCls }) {
  return (
    <section className="space-y-2">
      <h2 className={`text-base font-semibold ${colorCls}`}>{title}</h2>
      <div className="text-slate-300 text-sm leading-relaxed space-y-2">{children}</div>
    </section>
  )
}

function TermsContent({ name, email }) {
  return (
    <>
      <Section title="1. Acceptance of Terms" colorCls="text-blue-400">
        <p>By accessing and using the {name} platform ("Service"), you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using or accessing this Service. These terms apply to all visitors, users, and others who access or use the Service.</p>
      </Section>
      <Section title="2. Eligibility" colorCls="text-blue-400">
        <p>You must be at least 18 years of age and legally competent to enter into binding contracts to use this Service. By using the Service, you represent and warrant that you meet all eligibility requirements. We may, in our sole discretion, refuse to offer the Service to any person or entity and change eligibility criteria at any time.</p>
      </Section>
      <Section title="3. Account Registration & Security" colorCls="text-blue-400">
        <p>You must provide accurate, complete, and current information during the registration process and keep your account information updated. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify {name} immediately of any unauthorized use of your account or any other breach of security.</p>
        <p>{name} will not be liable for any loss or damage arising from your failure to comply with this security obligation.</p>
      </Section>
      <Section title="4. Trading Services & Risks" colorCls="text-blue-400">
        <p>Trading in financial instruments including forex, CFDs, and other derivatives involves substantial risk of loss and is not suitable for all investors. You should carefully consider your investment objectives, level of experience, and risk appetite before engaging in trading activities.</p>
        <p>Past performance of any financial instrument is not indicative of future results. You acknowledge that you may sustain a total loss of the funds in your trading account and, in some cases, additional losses beyond your deposits.</p>
      </Section>
      <Section title="5. Copy Trading" colorCls="text-blue-400">
        <p>Our copy trading feature allows you to replicate the trades of other traders ("Masters"). You understand that copying a Master trader does not guarantee profits. Past performance of a Master trader is not indicative of future results. You are solely responsible for setting appropriate risk parameters and monitoring your copy trading positions. {name} does not endorse any Master trader or guarantee the performance of any trading strategy.</p>
      </Section>
      <Section title="6. Deposits, Withdrawals & Fees" colorCls="text-blue-400">
        <p>All deposits and withdrawals are subject to our verification and KYC/AML compliance procedures. We reserve the right to request supporting documentation before processing any transaction. Processing times vary by payment method. {name} reserves the right to charge fees for certain services, which will be disclosed prior to the transaction.</p>
      </Section>
      <Section title="7. KYC & AML Compliance" colorCls="text-blue-400">
        <p>In compliance with anti-money laundering (AML) and Know Your Customer (KYC) regulations, you agree to provide all requested identity verification documents. {name} reserves the right to suspend or terminate accounts that fail to complete verification or are suspected of engaging in money laundering, terrorist financing, or other illegal activities.</p>
      </Section>
      <Section title="8. Prohibited Activities" colorCls="text-blue-400">
        <p>You agree not to: engage in any illegal activities, manipulate markets or exploit platform vulnerabilities, use automated systems to abuse the platform, provide false information, share account access with unauthorized parties, engage in abusive trading practices including arbitrage exploitation, or engage in any activity that could damage {name}'s reputation or operational integrity.</p>
      </Section>
      <Section title="9. Intellectual Property" colorCls="text-blue-400">
        <p>The Service and its original content, features, and functionality are owned by {name} and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws. You may not copy, modify, create derivative works, publicly display, or commercially exploit any content from the Service without express written permission.</p>
      </Section>
      <Section title="10. Limitation of Liability" colorCls="text-blue-400">
        <p>{name} shall not be liable for any direct, indirect, incidental, special, consequential, or exemplary damages, including but not limited to: trading losses, loss of profits, loss of data, system outages, unauthorized account access, or any other damages resulting from your use of the Service. In no event shall {name}'s total liability exceed the fees paid by you to {name} in the three months preceding the claim.</p>
      </Section>
      <Section title="11. Indemnification" colorCls="text-blue-400">
        <p>You agree to defend, indemnify, and hold harmless {name} and its officers, directors, employees, and agents from and against any claims, damages, obligations, losses, liabilities, costs, and expenses arising from your use of the Service, violation of these Terms, or violation of any rights of a third party.</p>
      </Section>
      <Section title="12. Termination" colorCls="text-blue-400">
        <p>{name} reserves the right to terminate or suspend your account and access to the Service, without prior notice or liability, for any reason, including if you breach these Terms. Upon termination, your right to use the Service will immediately cease. All provisions of these Terms which by their nature should survive termination shall remain in effect.</p>
      </Section>
      <Section title="13. Modifications to Terms" colorCls="text-blue-400">
        <p>We reserve the right to modify these Terms at any time. We will provide notice of significant changes by updating the date at the top of this page or by notifying you via email. Your continued use of the Service after such changes constitutes your acceptance of the new Terms.</p>
      </Section>
      <Section title="14. Governing Law" colorCls="text-blue-400">
        <p>These Terms shall be governed by and construed in accordance with applicable laws. Any disputes arising from these Terms or your use of the Service shall be subject to the exclusive jurisdiction of the competent courts.</p>
      </Section>
      <Section title="15. Contact Information" colorCls="text-blue-400">
        <p>For questions or concerns about these Terms, please contact us at <a href={`mailto:${email}`} className="text-blue-400 hover:text-blue-300">{email}</a>.</p>
      </Section>
    </>
  )
}

function PrivacyContent({ name, email }) {
  return (
    <>
      <Section title="1. Information We Collect" colorCls="text-cyan-400">
        <p><strong className="text-slate-200">Personal Information:</strong> Name, email address, phone number, date of birth, nationality, government-issued ID documents, proof of address, and financial information provided during registration and KYC verification.</p>
        <p><strong className="text-slate-200">Usage Data:</strong> IP address, browser type, device information, pages visited, time spent on the platform, trading activity, and interaction logs.</p>
        <p><strong className="text-slate-200">Financial Data:</strong> Payment details, transaction history, deposit and withdrawal records, and trading account information.</p>
      </Section>
      <Section title="2. How We Use Your Information" colorCls="text-cyan-400">
        <p>We use the information we collect to: provide, operate, and maintain our services; process transactions and send related information; verify your identity and comply with KYC/AML obligations; send administrative communications, security alerts, and support messages; improve and personalize your experience; analyze usage to improve our platform; comply with legal obligations and enforce our Terms; prevent fraud and detect security incidents; and send promotional communications (with your consent).</p>
      </Section>
      <Section title="3. Data Sharing & Disclosure" colorCls="text-cyan-400">
        <p>{name} does not sell, trade, or rent your personal information to third parties. We may share your information with: trusted service providers who assist in operating our platform (under strict confidentiality agreements); payment processors for transaction handling; regulatory authorities as required by law; law enforcement when legally compelled; and business successors in the event of a merger or acquisition.</p>
      </Section>
      <Section title="4. Data Security" colorCls="text-cyan-400">
        <p>We implement industry-standard security measures including SSL/TLS encryption for data transmission, AES-256 encryption for stored data, two-factor authentication options, regular security audits, and access controls limiting data to authorized personnel. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.</p>
      </Section>
      <Section title="5. Data Retention" colorCls="text-cyan-400">
        <p>We retain your personal data for as long as your account is active or as needed to provide services. We retain certain information for up to 7 years to comply with financial regulations, tax laws, and anti-money laundering requirements even after account closure. You may request deletion of your data subject to these retention obligations.</p>
      </Section>
      <Section title="6. Cookies & Tracking" colorCls="text-cyan-400">
        <p>We use cookies and similar tracking technologies to track activity on our platform and store certain information. You can instruct your browser to refuse all cookies or indicate when a cookie is being sent. However, some features of the Service may not function properly without cookies.</p>
      </Section>
      <Section title="7. Your Rights" colorCls="text-cyan-400">
        <p>Depending on your jurisdiction, you may have the right to: access personal data we hold about you; correct inaccurate or incomplete data; request deletion of your personal data; restrict or object to processing; receive your data in a portable format; and withdraw consent at any time. To exercise these rights, contact us at <a href={`mailto:${email}`} className="text-cyan-400 hover:text-cyan-300">{email}</a>.</p>
      </Section>
      <Section title="8. Third-Party Links" colorCls="text-cyan-400">
        <p>Our platform may contain links to third-party websites. We are not responsible for the privacy practices of those sites and encourage you to review their privacy policies. This Privacy Policy applies only to information collected through our Service.</p>
      </Section>
      <Section title="9. Children's Privacy" colorCls="text-cyan-400">
        <p>Our Service is not directed to individuals under the age of 18. We do not knowingly collect personal information from minors. If you become aware that a minor has provided us with personal information, please contact us immediately.</p>
      </Section>
      <Section title="10. Changes to This Policy" colorCls="text-cyan-400">
        <p>We may update this Privacy Policy periodically. We will notify you of significant changes via email or prominent notice on our platform. Continued use of the Service after changes become effective constitutes your acceptance of the updated policy.</p>
      </Section>
      <Section title="11. Contact Us" colorCls="text-cyan-400">
        <p>For privacy-related questions or to exercise your data rights, contact our Privacy Officer at <a href={`mailto:${email}`} className="text-cyan-400 hover:text-cyan-300">{email}</a>.</p>
      </Section>
    </>
  )
}

function RiskContent({ name }) {
  return (
    <>
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6">
        <p className="text-amber-300 text-sm font-medium">⚠️ Important Warning</p>
        <p className="text-amber-200/80 text-sm mt-1">Trading in financial instruments carries a high level of risk to your capital and may result in losses that exceed your initial investment. Please ensure you fully understand the risks involved before trading.</p>
      </div>
      <Section title="1. General Risk Warning" colorCls="text-amber-400">
        <p>Trading foreign exchange, contracts for difference (CFDs), and other financial derivatives involves significant risk and is not appropriate for all investors. The possibility exists that you could sustain a loss of some or all of your initial investment. Therefore, you should not invest money that you cannot afford to lose.</p>
      </Section>
      <Section title="2. Market Risk" colorCls="text-amber-400">
        <p>Financial markets are subject to rapid and unpredictable price movements driven by economic data, geopolitical events, market sentiment, and other factors. These movements can result in significant losses in a short period. Past market performance is not a reliable indicator of future performance.</p>
      </Section>
      <Section title="3. Leverage Risk" colorCls="text-amber-400">
        <p>Leveraged trading amplifies both potential profits and losses. Using leverage means you can lose more than your initial deposit. A small adverse movement in the market can result in a proportionally much larger loss relative to your account balance. You must fully understand how leverage works before trading.</p>
      </Section>
      <Section title="4. Liquidity Risk" colorCls="text-amber-400">
        <p>In certain market conditions, particularly during periods of high volatility or outside normal trading hours, you may be unable to execute a trade at the price you expect. Spreads may widen significantly and orders may be executed at prices different from those quoted (slippage).</p>
      </Section>
      <Section title="5. Technology Risk" colorCls="text-amber-400">
        <p>Electronic trading platforms are subject to technical failures, internet connectivity issues, software bugs, and cyber attacks. {name} cannot guarantee that the platform will be available at all times or that orders will always be executed as intended. You should have contingency plans for trading during platform outages.</p>
      </Section>
      <Section title="6. Counterparty Risk" colorCls="text-amber-400">
        <p>When trading through {name}, you are exposed to the risk that {name} may be unable to fulfill its financial obligations. While we maintain adequate capitalization and risk management procedures, no financial firm is without counterparty risk.</p>
      </Section>
      <Section title="7. Copy Trading Risks" colorCls="text-amber-400">
        <p>Copying other traders carries additional risks. The performance of a Master trader you copy may deteriorate significantly. You may copy strategies that were developed under different market conditions. The risk management of a Master trader may not be suitable for your financial situation. {name} does not vet, endorse, or guarantee the performance of any Master trader.</p>
      </Section>
      <Section title="8. Regulatory Risk" colorCls="text-amber-400">
        <p>Changes in laws and regulations can adversely affect trading conditions, the availability of certain financial instruments, or your ability to access your funds. You should stay informed about regulatory changes in your jurisdiction that may affect your trading activities.</p>
      </Section>
      <Section title="9. Currency Risk" colorCls="text-amber-400">
        <p>If your account base currency differs from the currency of the instruments you trade or your local currency, exchange rate movements can adversely affect your profits or losses when converted back to your base currency.</p>
      </Section>
      <Section title="10. Acknowledgement" colorCls="text-amber-400">
        <p>By using {name}'s services, you acknowledge that you have read, understood, and accepted all risks described in this disclosure. You confirm that you are aware of the risks involved in trading financial instruments and that you are financially and emotionally capable of sustaining any losses.</p>
      </Section>
    </>
  )
}

function ComplianceContent({ name, email }) {
  return (
    <>
      <Section title="1. Regulatory Compliance" colorCls="text-green-400">
        <p>{name} is committed to operating in full compliance with all applicable financial regulations, anti-money laundering laws, and international financial standards. We maintain robust compliance programs designed to prevent financial crime and protect our clients and the integrity of the financial system.</p>
      </Section>
      <Section title="2. Know Your Customer (KYC)" colorCls="text-green-400">
        <p>{name} maintains a rigorous KYC program. All clients are required to verify their identity before accessing full platform functionality. Required documents may include a government-issued photo ID (passport, national ID, or driver's license), proof of residence (utility bill or bank statement dated within 3 months), and for enhanced due diligence: proof of source of funds.</p>
        <p>We reserve the right to request additional documentation at any time and to restrict or suspend accounts that fail to provide requested verification materials.</p>
      </Section>
      <Section title="3. Anti-Money Laundering (AML)" colorCls="text-green-400">
        <p>We have implemented comprehensive AML procedures including: ongoing monitoring of client transactions for suspicious activity; reporting of suspicious transactions to relevant authorities as required by law; training of all relevant staff on AML obligations; risk-based customer due diligence; and regular review and updating of our AML policies.</p>
        <p>{name} does not accept cash deposits or payments from third parties. All deposits must originate from accounts held in the client's own name.</p>
      </Section>
      <Section title="4. Counter-Terrorist Financing (CTF)" colorCls="text-green-400">
        <p>{name} maintains policies to prevent the use of our services for terrorist financing. We screen clients against international sanctions lists and politically exposed persons (PEP) databases. Accounts identified as having links to terrorist organizations or sanctioned entities will be immediately suspended and reported to the relevant authorities.</p>
      </Section>
      <Section title="5. Sanctions Compliance" colorCls="text-green-400">
        <p>{name} complies with all applicable international sanctions programs. We do not provide services to individuals or entities in countries subject to international sanctions or on restricted persons lists. Clients must not use our services to facilitate any transaction that would violate applicable sanctions laws.</p>
      </Section>
      <Section title="6. Data Protection Compliance" colorCls="text-green-400">
        <p>We comply with applicable data protection laws including GDPR where applicable. We process personal data lawfully, fairly, and transparently. Personal data is collected for specified, explicit, and legitimate purposes and is not further processed in a manner incompatible with those purposes. We implement appropriate technical and organizational measures to ensure data security.</p>
      </Section>
      <Section title="7. Responsible Trading" colorCls="text-green-400">
        <p>{name} is committed to responsible trading practices. We provide risk warnings, educational resources, and risk management tools to help clients make informed trading decisions. We reserve the right to apply trading restrictions, reduce leverage, or contact clients we believe may be exhibiting signs of problematic trading behavior.</p>
      </Section>
      <Section title="8. Client Fund Protection" colorCls="text-green-400">
        <p>Client funds are held in segregated accounts separate from {name}'s own operational funds. This ensures that client funds cannot be used for company operational expenses and are protected in the event of insolvency. We conduct regular reconciliations to verify the accuracy of client fund records.</p>
      </Section>
      <Section title="9. Complaints Handling" colorCls="text-green-400">
        <p>We maintain a fair and transparent complaints handling procedure. Complaints should be submitted in writing to <a href={`mailto:${email}`} className="text-green-400 hover:text-green-300">{email}</a>. We will acknowledge your complaint within 24 hours and aim to resolve all complaints within 10 business days. If you are dissatisfied with our response, you may escalate to the relevant regulatory authority.</p>
      </Section>
      <Section title="10. Reporting Concerns" colorCls="text-green-400">
        <p>If you become aware of any potential compliance violations, suspicious activities, or financial crimes involving {name}'s platform, please report them immediately to our compliance team at <a href={`mailto:${email}`} className="text-green-400 hover:text-green-300">{email}</a>. All reports are treated confidentially.</p>
      </Section>
    </>
  )
}

export default function LegalPage() {
  const { type } = useParams()
  const { companyName, email, logoUrl, fetchCompanySettings, isLoaded } = useCompanyStore()

  useEffect(() => {
    if (!isLoaded) fetchCompanySettings()
  }, [isLoaded, fetchCompanySettings])

  const config = PAGE_CONFIG[type]
  if (!config) return <Navigate to="/login" replace />

  const colors = COLOR_MAP[config.color]
  const name = companyName || 'Our Platform'
  const supportEmail = email || 'support@example.com'
  const Icon = config.icon

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur-xl border-b border-slate-700/50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img src={getUploadUrl(logoUrl)} alt="Logo" className="h-8 object-contain" />
            ) : isLoaded ? (
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xs">{name.substring(0, 2).toUpperCase()}</span>
              </div>
            ) : null}
            <span className="font-semibold text-white">{name}</span>
          </div>
          <Link to="/login" className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Login
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-10">
        {/* Page title */}
        <div className="mb-8">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${colors.bg} border ${colors.border} mb-4`}>
            <Icon className={`w-4 h-4 ${colors.icon}`} />
            <span className={`text-sm font-medium ${colors.icon}`}>Legal Document</span>
          </div>
          <h1 className="text-3xl font-bold text-white">{config.title}</h1>
          <p className="text-slate-400 mt-2 text-sm">
            {name} · Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>

        {/* Legal nav */}
        <div className="flex flex-wrap gap-2 mb-8">
          {Object.entries(PAGE_CONFIG).map(([key, cfg]) => (
            <Link
              key={key}
              to={`/legal/${key}`}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                key === type
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              {cfg.title}
            </Link>
          ))}
        </div>

        {/* Content */}
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 md:p-8 space-y-6">
          {type === 'terms' && <TermsContent name={name} email={supportEmail} />}
          {type === 'privacy' && <PrivacyContent name={name} email={supportEmail} />}
          {type === 'risk-disclosure' && <RiskContent name={name} />}
          {type === 'compliance' && <ComplianceContent name={name} email={supportEmail} />}
        </div>

        {/* Footer nav */}
        <div className="mt-8 flex flex-wrap gap-4 justify-center">
          {Object.entries(PAGE_CONFIG).filter(([k]) => k !== type).map(([key, cfg]) => (
            <Link key={key} to={`/legal/${key}`} className="text-sm text-slate-400 hover:text-white transition-colors">
              {cfg.title}
            </Link>
          ))}
        </div>
        <p className="text-center text-slate-500 text-xs mt-6">
          © {new Date().getFullYear()} {name}. All rights reserved.
        </p>
      </main>
    </div>
  )
}
