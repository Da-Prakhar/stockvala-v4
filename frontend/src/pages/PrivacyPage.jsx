import React from 'react'
import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useCompanyStore } from '../store/companyStore'

const PrivacyPage = () => {
  const navigate = useNavigate()
  const { companyName } = useCompanyStore()
  const name = companyName || 'Our platform'

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-6">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Privacy Policy</h1>

      <div className="prose prose-slate dark:prose-invert max-w-none space-y-6 text-sm text-slate-600 dark:text-slate-400">
        <section>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">1. Information We Collect</h2>
          <p>We collect personal information you provide during registration, including your name, email address, phone number, and identification documents for KYC verification. We also collect trading activity data, device information, and usage analytics.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">2. How We Use Your Information</h2>
          <p>Your information is used to provide and improve our services, process transactions, verify your identity, comply with legal obligations, prevent fraud, and communicate with you about your account and platform updates.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">3. Data Security</h2>
          <p>We implement industry-standard security measures to protect your personal and financial data, including encryption, secure servers, and access controls. However, no method of transmission over the internet is 100% secure.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">4. Data Sharing</h2>
          <p>We do not sell your personal information to third parties. We may share your data with payment processors to complete transactions, regulatory authorities as required by law, and service providers who assist in operating our platform under strict confidentiality agreements.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">5. KYC Documents</h2>
          <p>Identity documents submitted for KYC verification are stored securely and used solely for compliance purposes. Documents are retained as required by applicable regulations and deleted when no longer needed.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">6. Cookies</h2>
          <p>We use cookies and similar technologies to maintain your session, remember your preferences, and improve our services. You can control cookie settings through your browser preferences.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">7. Your Rights</h2>
          <p>You have the right to access, correct, or delete your personal data. You may request a copy of the data we hold about you. To exercise these rights, contact our support team.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">8. Data Retention</h2>
          <p>We retain your personal data for as long as your account is active and as required by applicable laws and regulations. Trading records may be retained for a minimum of 5 years as required by financial regulations.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">9. Contact</h2>
          <p>For privacy-related inquiries, please contact us through our Support page.</p>
        </section>

        <p className="text-xs text-slate-400 mt-8">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
      </div>
    </div>
  )
}

export default PrivacyPage
