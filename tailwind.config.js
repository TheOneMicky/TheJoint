/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        slate: {
          900: '#1A1A1A',
          800: '#2A2A2A',
          700: '#3A3A3A',
          600: '#4A4A4A',
          500: '#5A5A5A',
          400: '#7A7A7A',
          300: '#9A9A9A',
          200: '#BABABA',
          100: '#EAEAEA',
        },
        orange: {
          DEFAULT: '#FF6B35',
          50: '#FFF0EB',
          100: '#FFE1D6',
          200: '#FFC3AD',
          300: '#FFA584',
          400: '#FF875C',
          500: '#FF6B35',
          600: '#E55A2B',
          700: '#CC4A22',
          800: '#B33A1A',
          900: '#992A12',
        },
        background: '#1A1A1A',
        foreground: '#FFFFFF',
        card: '#2A2A2A',
        border: '#3A3A3A',
        muted: '#9A9A9A',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        'card': '12px',
      },
      boxShadow: {
        'glow': '0 0 20px rgba(255, 107, 53, 0.4), 0 0 40px rgba(255, 107, 53, 0.2)',
        'glow-sm': '0 0 10px rgba(255, 107, 53, 0.3)',
        'card': '0 1px 3px rgba(0, 0, 0, 0.3)',
      },
    },
  },
  plugins: [],
}
