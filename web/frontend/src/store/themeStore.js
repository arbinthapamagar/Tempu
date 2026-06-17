import { create } from 'zustand'

const KEY = 'shakti_theme' // 'system' | 'light' | 'dark'

const mql = window.matchMedia('(prefers-color-scheme: dark)')
const systemDark = () => mql.matches

function applyClass(mode) {
  const dark = mode === 'dark' || (mode === 'system' && systemDark())
  document.documentElement.classList.toggle('dark', dark)
}

const initial = localStorage.getItem(KEY) || 'system'
applyClass(initial) // apply before first paint of the app shell

export const useThemeStore = create((set) => ({
  mode: initial,
  setMode: (mode) => {
    localStorage.setItem(KEY, mode)
    applyClass(mode)
    set({ mode })
  },
}))

// Follow the OS when in "system" mode.
mql.addEventListener('change', () => {
  if ((localStorage.getItem(KEY) || 'system') === 'system') applyClass('system')
})
