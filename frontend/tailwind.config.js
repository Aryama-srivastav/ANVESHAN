/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        obsidian: {
          900: '#090A0F',
          800: '#11131a',
          700: '#181a24'
        },
        navy: {
          900: '#0F172A',
          800: '#1E293B'
        },
        cybergold: '#D4AF37',
        biometric: '#00F0FF',
        cyberalert: '#FF003C'
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['Fira Code', 'monospace']
      }
    },
  },
  plugins: [],
}
