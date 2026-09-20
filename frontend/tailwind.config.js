/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        darkBg: '#0f172a',
        darkCard: 'rgba(255, 255, 255, 0.05)',
        accentCyan: '#22d3ee',
        brandPrimary: '#6366f1',
      }
    },
  },
  plugins: [],
}
