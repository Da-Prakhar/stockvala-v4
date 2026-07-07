import React, { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { useThemeStore } from './store/themeStore'
import { useCompanyStore } from './store/companyStore'
import { AdminLayout } from './components/layout/AdminLayout'

// Pages
import AdminLoginPage from './pages/AdminLoginPage'
import AdminDashboardPage from './pages/AdminDashboardPage'
import ClientsPage from './pages/ClientsPage'
import ClientDetailPage from './pages/ClientDetailPage'
import DepositApproverPage from './pages/DepositApproverPage'
import WithdrawalApproverPage from './pages/WithdrawalApproverPage'
import KYCApproverPage from './pages/KYCApproverPage'
import CopyTradeManagerPage from './pages/CopyTradeManagerPage'
import MAMManagerPage from './pages/MAMManagerPage'
import PAMMManagerPage from './pages/PAMMManagerPage'
import RolesPage from './pages/RolesPage'
import SupportManagerPage from './pages/SupportManagerPage'
import TicketDetailPage from './pages/TicketDetailPage'
import SettingsPage from './pages/SettingsPage'
import PaymentMethodsPage from './pages/PaymentMethodsPage'
import CompanySettingsPage from './pages/CompanySettingsPage'
import TradingSettingsPage from './pages/TradingSettingsPageV2'
import ManagersPage from './pages/ManagersPage'
import MT5ManagementPage from './pages/MT5ManagementPage'
import RiskMonitorPage from './pages/RiskMonitorPage'
import IBSettingsPage from './pages/IBSettingsPage'
import BonusManagerPage from './pages/BonusManagerPage'

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <AdminLayout>{children}</AdminLayout>
}

export default function App() {
  const { theme, setTheme } = useThemeStore()

  useEffect(() => {
    // Ensure correct theme class on mount and theme change
    document.documentElement.classList.remove('dark')
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    }
  }, [theme])

  useEffect(() => {
    useCompanyStore.getState().fetchCompanySettings()
  }, [])

  return (
    <Router basename={
      // Sub-path mode: backend serves admin at /broker/* on the API domain
      // Normal mode: admin is hosted at root of broker.onefx.co.in
      window.location.pathname.startsWith('/broker/') || window.location.pathname === '/broker' ? '/broker' : '/'
    }>
      <Routes>
        <Route path="/login" element={<AdminLoginPage />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <AdminDashboardPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/clients"
          element={
            <ProtectedRoute>
              <ClientsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/clients/:id"
          element={
            <ProtectedRoute>
              <ClientDetailPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/deposits"
          element={
            <ProtectedRoute>
              <DepositApproverPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/withdrawals"
          element={
            <ProtectedRoute>
              <WithdrawalApproverPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/kyc"
          element={
            <ProtectedRoute>
              <KYCApproverPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/copy-trading"
          element={
            <ProtectedRoute>
              <CopyTradeManagerPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/mam"
          element={
            <ProtectedRoute>
              <MAMManagerPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/pamm"
          element={
            <ProtectedRoute>
              <PAMMManagerPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/roles"
          element={
            <ProtectedRoute>
              <RolesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/support"
          element={
            <ProtectedRoute>
              <SupportManagerPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/support/:id"
          element={
            <ProtectedRoute>
              <TicketDetailPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/settings/payment-methods"
          element={
            <ProtectedRoute>
              <PaymentMethodsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/settings/company"
          element={
            <ProtectedRoute>
              <CompanySettingsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/settings/trading"
          element={
            <ProtectedRoute>
              <TradingSettingsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/settings/managers"
          element={
            <ProtectedRoute>
              <ManagersPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/mt5"
          element={
            <ProtectedRoute>
              <MT5ManagementPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/risk-monitor"
          element={
            <ProtectedRoute>
              <RiskMonitorPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/ib"
          element={
            <ProtectedRoute>
              <IBSettingsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/bonuses"
          element={
            <ProtectedRoute>
              <BonusManagerPage />
            </ProtectedRoute>
          }
        />

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  )
}
