/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Roboto — the ShipOS / NobleUI theme font.
        sans: ['Roboto', 'Segoe UI', 'system-ui', 'sans-serif'],
        display: ['Roboto', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        ink: '#111827',
        paper: '#f3f4f6',
        surface: '#ffffff',
        accent: '#e85d04',
      },
    },
  },
  plugins: [],
}
