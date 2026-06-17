/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Body/UI is a warm humanist grotesque; display is the deliberately
        // irregular Bricolage Grotesque; data/labels use a mono.
        sans: ['Hanken Grotesk', 'system-ui', 'sans-serif'],
        display: ['Bricolage Grotesque', 'Hanken Grotesk', 'system-ui', 'sans-serif'],
        mono: ['Spline Sans Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        ink: '#241f1a',
        paper: '#f4eee3',
        surface: '#fffcf7',
        accent: '#e8590c',
      },
    },
  },
  plugins: [],
}
