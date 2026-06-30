import React from 'react'
import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useCompanyStore } from '../store/companyStore'

const TermsPage = () => {
  const navigate = useNavigate()
  const { companyName, email } = useCompanyStore()
  const name = companyName || 'Our platform'
  const supportEmail = email || 'support'

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-6">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Terms & Conditions</h1>

      <div className="prose prose-slate dark:prose-invert max-w-none space-y-6 text-sm text-slate-600 dark:text-slate-400">
        <section>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">1. Acceptance of Terms</h2>
          <p>By accessing and using the {name} platform, you agree to be bound by these Terms and Conditions. If you do not agree to these terms, please do not use our services.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">2. Account Registration</h2>
          <p>You must provide accurate and complete information when creating an account. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must be at least 18 years old to use our services.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">3. Trading Risks</h2>
          <p>Trading in financial instruments involves substantial risk of loss and is not suitable for all investors. Past performance is not indicative of future results. You should carefully consider whether trading is suitable for you in light of your financial condition. You acknowledge that you are solely responsible for your trading decisions.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">4. Copy Trading Disclaimer</h2>
          <p>Copy trading allows you to replicate trades of other traders. However, past performance of any master trader is not a guarantee of future performance. You should set appropriate risk limits and monitor your copy trading positions regularly.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">5. Deposits and Withdrawals</h2>
          <p>All deposit and withdrawal requests are subject to verification. We reserve the right to request additional documentation for KYC/AML compliance. Processing times may vary depending on the payment method selected.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">6. Prohibited Activities</h2>
          <p>You agree not to use our platform for any illegal activities, money laundering, terrorist financing, or any activity that violates applicable laws and regulations. We reserve the right to suspend or terminate accounts that engage in prohibited activities.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">7. Limitation of Liability</h2>
          <p>{name} shall not be liable for any direct, indirect, incidental, consequential, or exemplary damages arising from your use of the platform, including but not limited to trading losses, system outages, or unauthorized access to your account.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">8. Modifications</h2>
          <p>We reserve the right to modify these terms at any time. Changes will be effective immediately upon posting. Your continued use of the platform after any changes constitutes acceptance of the modified terms.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">9. Contact</h2>
          <p>For questions about these terms, please contact our support team through the Support page.</p>
        </section>

        <p className="text-xs text-slate-400 mt-8">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
      </div>
    </div>
  )
}

export default TermsPage
