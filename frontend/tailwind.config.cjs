/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        charcoal: {
          DEFAULT: 'rgb(var(--salon-charcoal-rgb, 23 23 22) / <alpha-value>)',
          deep: 'rgb(var(--salon-charcoal-deep-rgb, 17 17 16) / <alpha-value>)',
          raised: 'rgb(var(--salon-charcoal-raised-rgb, 32 31 28) / <alpha-value>)',
        },
        gold: {
          DEFAULT: 'rgb(var(--salon-gold-rgb, 198 166 106) / <alpha-value>)',
          light: 'rgb(var(--salon-gold-light-rgb, 228 207 159) / <alpha-value>)',
        },
        cream: 'rgb(var(--salon-cream-rgb, 242 238 229) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-7px)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 700ms ease-out both',
        float: 'float 7s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
