/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f1f5ff',
          100: '#e2eaff',
          200: '#c4d4ff',
          300: '#9bb4ff',
          400: '#6c8aff',
          500: '#4a64f5',
          600: '#3a4cdb',
          700: '#2f3bb0',
          800: '#262f8a',
          900: '#1d246b',
        },
        ink: {
          50: '#f7f8fa',
          100: '#eef0f4',
          200: '#dde1ea',
          300: '#b9c1d1',
          400: '#7e889e',
          500: '#4d566a',
          600: '#33394a',
          700: '#22273a',
          800: '#161a2c',
          900: '#0c0f1f',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(15, 18, 31, 0.06), 0 4px 16px rgba(15, 18, 31, 0.04)',
      },
    },
  },
  plugins: [],
};
