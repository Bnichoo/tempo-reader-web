/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sepia: {
          50:  '#f6efe7',
          100: '#efe6db',
          200: '#e7dbc9',
          300: '#d7c4a8',
          400: '#bda280',
          500: '#a88962',
          600: '#8f704a',
          700: '#745b3d',
          800: '#5e4a32',
          900: '#4e3e2a'
        }
      }
    }
  },
  plugins: []
}
