/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Roboto - the ShipOS / NobleUI theme font.
        sans: ['Roboto', 'Segoe UI', 'system-ui', 'sans-serif'],
        display: ['Roboto', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        ink: '#0b0d11',
        paper: '#f3f4f6',
        surface: '#ffffff',
        accent: '#2f343c',
        // The app was built with `orange-*` as its accent. We remap that scale to
        // a calm neutral ink ramp so the whole admin reads simple & restrained
        // (matching Support) without touching every file. Revert this block to
        // bring the orange brand colour back.
        orange: {
          50: '#f6f6f7',
          100: '#ececed',
          200: '#d9dadc',
          300: '#b9bbbe',
          400: '#8a8d92',
          500: '#565a61',
          600: '#2f343c',
          700: '#23272e',
          800: '#1a1d22',
          900: '#111317',
        },
        // Tailwind's default `gray` is cool (blue-tinted) - `gray-900` is #111827,
        // which reads navy. Remap to a TRUE-neutral ramp with a near-black top so
        // all text is black (not navy) in light mode, app-wide.
        gray: {
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e7e7e9',
          300: '#d3d3d6',
          400: '#9b9ba1',
          500: '#6e6e74',
          600: '#48484d',
          700: '#2c2c30',
          800: '#18181c',
          900: '#0a0a0b',
        },
      },
    },
  },
  plugins: [],
}
