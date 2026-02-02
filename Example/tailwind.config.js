/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Light pastel colors for TutorCat
        primary: {
          50: '#f0f4ff',
          100: '#e0e9ff',
          200: '#c7d4ff',
          300: '#a5b9ff',
          400: '#8399ff',
          500: '#6175ff', // Main blue
          600: '#4a5fff',
          700: '#3d4eff',
          800: '#2f3fff',
          900: '#1a2aff',
        },
        secondary: {
          50: '#fdf4ff',
          100: '#fae8ff',
          200: '#f5d0ff',
          300: '#f0abff',
          400: '#e879ff',
          500: '#d946ff', // Main purple
          600: '#c026d3',
          700: '#a21caf',
          800: '#86198f',
          900: '#701a75',
        },
        accent: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6', // Teal accent
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
        neutral: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
        },
        // Mascot colors
        cat: {
          whisker: '#fbbf24', // Amber for whiskers
          paw: '#f59e0b',     // Amber for paws
          eye: '#3b82f6',     // Blue for eyes
          fur: '#f3f4f6',     // Light gray for fur
        }
      },
      backgroundImage: {
        'gradient-pastel': 'linear-gradient(135deg, #f0f4ff 0%, #fdf4ff 50%, #f0fdfa 100%)',
        'gradient-primary': 'linear-gradient(135deg, #6175ff 0%, #d946ff 100%)',
        'gradient-secondary': 'linear-gradient(135deg, #14b8a6 0%, #6175ff 100%)',
      },
      animation: {
        'bounce-slow': 'bounce 3s infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'meow': 'meow 0.6s ease-in-out',
      },
      keyframes: {
        meow: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.1)' },
        },
      },
      fontFamily: {
        'sans': ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        'display': ['Poppins', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
