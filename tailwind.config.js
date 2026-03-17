/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        chen: {
          orange: '#E8640A',
          orangeDim: '#C4530A',
          bg: '#0D0B09',
          bgCard: '#151210',
          bgElevated: '#1C1814',
          textPrimary: '#F5F0EB',
          textSecondary: '#9D8F85',
          textMuted: '#5C504A',
          border: 'rgba(232, 100, 10, 0.12)',
          borderStrong: 'rgba(232, 100, 10, 0.25)',
          success: '#27AE60',
          error: '#E74C3C',
        },
        theme: {
          default: '#E8640A',
          lagosNight: '#7C3AED',
          harmattan: '#D4A017',
          midnightAfro: '#00BFA5',
          atilolaRed: '#E74C3C',
        },
      },
      borderRadius: {
        '3xl': '2rem',
        '4xl': '2.5rem',
      },
      keyframes: {
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
        slideUp: {
          from: { transform: 'translateY(20px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        pulse: 'pulse 2s ease-in-out infinite',
        slideUp: 'slideUp 0.3s ease-out',
      },
    },
  },
  plugins: [],
};