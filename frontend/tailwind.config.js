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
          900: '#F4EFE4',
          800: '#FBF8F1',
          700: '#EDE6D3'
        },
        navy: {
          900: '#1B2A4A',
          800: '#24407A'
        },
        cybergold: '#9A7B2E',
        biometric: '#24407A',
        cyberalert: '#7A1F2B',
        parchment: '#F4EFE4',
        paper: '#FBF8F1',
        ink: '#1B2A4A',
        registry: '#24407A',
        seal: '#7A1F2B',
        brass: '#9A7B2E',
        ledger: '#1E6B4A',
        fileline: '#D8CFB8'
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        serif: ['Source Serif 4', 'Spectral', 'Georgia', 'serif'],
        mono: ['Fira Code', 'monospace']
      }
    },
  },
  plugins: [],
}
