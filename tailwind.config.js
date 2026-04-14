/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        outfit: ['Outfit', 'sans-serif'],
      },
      colors: {
        indigo: {
          500: '#6366f1',
          600: '#4f46e5',
        },
        slate: {
          950: '#020617',
        }
      }
    },
  },
  plugins: [],
}
