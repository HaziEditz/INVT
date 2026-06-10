/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bw: {
          bg: '#0f1117',
          surface: '#1a1d27',
          card: '#1e2132',
          border: '#2a2d3e',
          primary: '#4f6ef7',
          success: '#22c55e',
          warning: '#f59e0b',
          danger: '#ef4444',
          text: '#e2e8f0',
          muted: '#64748b',
          gold: '#dfba5f',
        },
        status: {
          available: '#22c55e',
          picking: '#3b82f6',
          active: '#f59e0b',
          busy: '#f97316',
          away: '#64748b',
          suspended: '#ef4444',
        },
        service: {
          taxi: '#3b82f6',
          food: '#f97316',
          freight: '#8b5cf6',
          tm: '#06b6d4',
          acc: '#ec4899',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
