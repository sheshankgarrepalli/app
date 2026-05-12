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
        accent: {
          DEFAULT: '#059669',
          hover: '#047857',
          light: 'rgba(5,150,105,0.1)',
        },
        destructive: '#DC2626',
        success: '#16A34A',
        warning: '#D97706',
        info: '#2563EB',
        purple: '#7C3AED',
        orange: '#EA580C',
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.08)',
        'card-hover': '0 4px 16px rgba(0,0,0,0.12)',
      },
      borderRadius: {
        'card': '8px',
      },
    },
  },
  plugins: [],
}
