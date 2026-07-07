import React, { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './store/authStore'
import { useThemeStore } from './store/themeStore'
import { useCompanyStore } from './store/companyStore'
import DashboardLayout from './components/layout/DashboardLayout'
import DashboardPage from './pages/DashboardPage'
import AccountsPage from './pages/AccountsPage'
import CreateAccountPage from './pages/CreateAccountPage'
import FundPage from './pages/FundPage'
import DepositPage from './pages/DepositPage'
import WithdrawPage from './pages/WithdrawPage'
import TradePage from './pages/TradePage'
import CopyTradingPage from './pages/CopyTradingPage'
import MasterDetailPage from './pages/MasterDetailPage'
import MamPage from './pages/MamPage'
import PammPage from './pages/PammPage'
import WalletPage from './pages/WalletPage'
import SupportPage from './pages/SupportPage'
import TicketDetailPage from './pages/TicketDetailPage'
import DownloadsPage from './pages/DownloadsPage'
import IBPage from './pages/IBPage'
import ProfilePage from './pages/ProfilePage'
import KYCPage from './pages/KYCPage'
import NotificationsPage from './pages/NotificationsPage'
import TermsPage from './pages/TermsPage'
import PrivacyPage from './pages/PrivacyPage'
import CompanyPage from './pages/CompanyPage'
import RiskMonitorPage from './pages/RiskMonitorPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import LegalPage from './pages/LegalPage'
import AuthCallbackPage from './pages/AuthCallbackPage'
import BonusPage from './pages/BonusPage'

function App() {
  const { refreshAuth } = useAuthStore()
  const { initTheme } = useThemeStore()

  useEffect(() => {
    // Initialize stores
    initTheme()
    refreshAuth()
    useCompanyStore.getState().fetchCompanySettings()
  }, [])

  return (
    <BrowserRouter basename={
      window.location.pathname.startsWith('/user/') || window.location.pathname === '/user' ? '/user' :
      window.location.pathname.startsWith('/user-crm/') || window.location.pathname === '/user-crm' ? '/user-crm' :
      '/'
    }>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#1a2332',
            color: '#e2e8f0',
            border: '1px solid #2a3a55',
            borderRadius: '8px',
            fontSize: '13px',
          },
          success: {
            iconTheme: { primary: '#22c55e', secondary: '#0a0e1a' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#0a0e1a' },
          },
        }}
      />
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/legal/:type" element={<LegalPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />

        {/* Dashboard Routes */}
        <Route
          path="/dashboard"
          element={
            <DashboardLayout pageTitle="Dashboard">
              <DashboardPage />
            </DashboardLayout>
          }
        />

        <Route
          path="/accounts"
          element={
            <DashboardLayout pageTitle="Accounts">
              <AccountsPage />
            </DashboardLayout>
          }
        />

        <Route
          path="/accounts/create"
          element={
            <DashboardLayout pageTitle="Create Account">
              <CreateAccountPage />
            </DashboardLayout>
          }
        />

        <Route
          path="/fund"
          element={
            <DashboardLayout pageTitle="Fund Management">
              <FundPage />
            </DashboardLayout>
          }
        />

        <Route
          path="/fund/deposit"
          element={
            <DashboardLayout pageTitle="Deposit Funds">
              <DepositPage />
            </DashboardLayout>
          }
        />

        <Route
          path="/fund/withdraw"
          element={
            <DashboardLayout pageTitle="Withdraw Funds">
              <WithdrawPage />
            </DashboardLayout>
          }
        />

        <Route
          path="/wallet"
          element={
            <DashboardLayout pageTitle="Wallet">
              <WalletPage />
            </DashboardLayout>
          }
        />

        <Route
          path="/trade"
          element={
            <DashboardLayout pageTitle="Trading" fullBleed>
              <TradePage />
            </DashboardLayout>
          }
        />

        <Route
          path="/copy-trading"
          element={
            <DashboardLayout pageTitle="Copy Trading">
              <CopyTradingPage />
            </DashboardLayout>
          }
        />

        <Route
          path="/copy-trading/:id"
          element={
            <DashboardLayout pageTitle="Master Details">
              <MasterDetailPage />
            </DashboardLayout>
          }
        />

        <Route
          path="/mam"
          element={
            <DashboardLayout pageTitle="MAM">
              <MamPage />
            </DashboardLayout>
          }
        />

        <Route
          path="/pamm"
          element={
            <DashboardLayout pageTitle="PAMM">
              <PammPage />
            </DashboardLayout>
          }
        />


        <Route
          path="/support"
          element={
            <DashboardLayout pageTitle="Support">
              <SupportPage />
            </DashboardLayout>
          }
        />

        <Route
          path="/support/:id"
          element={
            <DashboardLayout pageTitle="Ticket Details">
              <TicketDetailPage />
            </DashboardLayout>
          }
        />

        <Route
          path="/downloads"
          element={
            <DashboardLayout pageTitle="Downloads">
              <DownloadsPage />
            </DashboardLayout>
          }
        />

        <Route
          path="/ib"
          element={
            <DashboardLayout pageTitle="IB Dashboard">
              <IBPage />
            </DashboardLayout>
          }
        />

        <Route
          path="/profile"
          element={
            <DashboardLayout pageTitle="Profile">
              <ProfilePage />
            </DashboardLayout>
          }
        />

        <Route
          path="/kyc"
          element={
            <DashboardLayout pageTitle="KYC Verification">
              <KYCPage />
            </DashboardLayout>
          }
        />

        <Route
          path="/notifications"
          element={
            <DashboardLayout pageTitle="Notifications">
              <NotificationsPage />
            </DashboardLayout>
          }
        />

        <Route
          path="/terms"
          element={
            <DashboardLayout pageTitle="Terms & Conditions">
              <TermsPage />
            </DashboardLayout>
          }
        />

        <Route
          path="/privacy"
          element={
            <DashboardLayout pageTitle="Privacy Policy">
              <PrivacyPage />
            </DashboardLayout>
          }
        />

        <Route
          path="/company"
          element={
            <DashboardLayout pageTitle="About Us">
              <CompanyPage />
            </DashboardLayout>
          }
        />

        <Route
          path="/bonuses"
          element={
            <DashboardLayout pageTitle="Bonuses">
              <BonusPage />
            </DashboardLayout>
          }
        />

        {/* Risk Monitor — full-bleed admin tool, no nav shell */}
        <Route path="/risk-monitor" element={<RiskMonitorPage />} />

        {/* Fallback */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
