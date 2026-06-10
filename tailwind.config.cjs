/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bw: {
          bg: '#13151f',
          header: '#0f1420',
          surface: '#1a1d2e',
          card: '#1e2235',
          cardHover: '#242840',
          border: '#2d3148',
          primary: '#5b7cfa',
          success: '#22c55e',
          warning: '#f59e0b',
          danger: '#ef4444',
          text: '#e8eaf0',
          muted: '#8892a4',
          gold: '#dfba5f',
        },
        status: {
          available: '#22c55e',
          picking: '#3b82f6',
          active: '#f59e0b',
          busy: '#f97316',
          away: '#8892a4',
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
