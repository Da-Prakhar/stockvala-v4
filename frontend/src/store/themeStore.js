import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useThemeStore = create(
  persist(
    (set) => ({
      isDark: false,

      toggleTheme: () => {
        set((state) => {
          const newIsDark = !state.isDark

          if (newIsDark) {
            document.documentElement.classList.add('dark')
          } else {
            document.documentElement.classList.remove('dark')
          }

          return { isDark: newIsDark }
        })
      },

      setTheme: (isDark) => {
        if (isDark) {
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.classList.remove('dark')
        }
        set({ isDark })
      },

      initTheme: () => {
        // Default to light — persisted state from zustand will override if user toggled before
        set((state) => {
          if (state.isDark) {
            document.documentElement.classList.add('dark')
          } else {
            document.documentElement.classList.remove('dark')
          }
          return {}
        })
      },
    }),
    {
      name: 'theme-store',
      version: 1,
    }
  )
)
