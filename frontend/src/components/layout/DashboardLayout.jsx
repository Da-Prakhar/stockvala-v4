import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

const DashboardLayout = ({ children, pageTitle, fullBleed = false }) => {
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const refreshAuth = useAuthStore((state) => state.refreshAuth)
  const [isChecking, setIsChecking] = useState(true)
  const hasChecked = useRef(false)
  // Mobile sidebar state — lifted up so TopBar hamburger can control it
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const closeSidebar = useCallback(() => setMobileSidebarOpen(false), [])
  const openSidebar = useCallback(() => setMobileSidebarOpen(true), [])

  useEffect(() => {
    if (isAuthenticated) {
      setIsChecking(false)
      return
    }

    if (hasChecked.current) return
    hasChecked.current = true

    const checkAuth = async () => {
      try {
        const result = await refreshAuth()
        if (!result) {
          navigate('/login', { replace: true })
        }
      } catch {
        navigate('/login', { replace: true })
      } finally {
        setIsChecking(false)
      }
    }

    checkAuth()
  }, [isAuthenticated])

  if (isChecking || !isAuthenticated) {
    return (
      <div className="flex h-screen bg-slate-900 items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden">
      <Sidebar isOpen={mobileSidebarOpen} onClose={closeSidebar} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopBar pageTitle={pageTitle} onMenuOpen={openSidebar} />
        <main className={`flex-1 ${fullBleed ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          {fullBleed ? children : (
            <div className="p-4 md:p-6 min-h-full flex flex-col">
              <div className="flex-1">{children}</div>
              <footer className="mt-8 pt-4 border-t border-slate-200 dark:border-slate-700 text-center text-xs text-slate-400 dark:text-slate-500">
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <a href="/terms" className="hover:text-slate-600 dark:hover:text-slate-300">Terms</a>
                  <span>·</span>
                  <a href="/privacy" className="hover:text-slate-600 dark:hover:text-slate-300">Privacy</a>
                  <span>·</span>
                  <a href="/company" className="hover:text-slate-600 dark:hover:text-slate-300">About</a>
                  <span>·</span>
                  <a href="/support" className="hover:text-slate-600 dark:hover:text-slate-300">Support</a>
                </div>
                <p className="mt-2">&copy; {new Date().getFullYear()} All rights reserved.</p>
              </footer>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default DashboardLayout