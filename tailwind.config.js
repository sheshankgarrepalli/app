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
        navy: {
          DEFAULT: '#1a1a2e',
          light: '#252540',
          dark: '#12121f',
        },
        accent: {
          DEFAULT: '#e94560',
          hover: '#d63d52',
          light: 'rgba(233,69,96,0.1)',
        },
        success: {
          DEFAULT: '#0f3460',
          light: '#1a4a7a',
        },
        surface: {
          DEFAULT: '#f5f5f5',
          card: '#ffffff',
        },
        neon: {
          cyan: '#00f0ff',
          purple: '#a855f7',
          pink: '#e94560',
        },
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #e94560, #a855f7)',
        'gradient-cyan': 'linear-gradient(135deg, #00f0ff, #a855f7)',
        'gradient-mesh': 'radial-gradient(ellipse at top left, rgba(233,69,96,0.08), transparent 50%), radial-gradient(ellipse at bottom right, rgba(168,85,247,0.08), transparent 50%)',
        'gradient-sidebar': 'linear-gradient(135deg, rgba(233,69,96,0.15), rgba(168,85,247,0.1))',
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
