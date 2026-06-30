import React, { useEffect } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useThemeStore } from '../../store/themeStore'

export const ThemeToggle = () => {
  const { theme, toggleTheme, setTheme } = useThemeStore()

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme-store')
    if (savedTheme) {
      const { state } = JSON.parse(savedTheme)
      setTheme(state.theme)
    } else {
      setTheme('dark')
    }
  }, [setTheme])

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg bg-dark-100 dark:bg-dark-800 text-dark-600 dark:text-dark-400 hover:bg-dark-200 dark:hover:bg-dark-700 transition-colors"
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? (
        <Sun className="w-5 h-5" />
      ) : (
        <Moon className="w-5 h-5" />
      )}
    </button>
  )
}
