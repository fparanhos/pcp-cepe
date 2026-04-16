import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cepe: {
          green: '#005F3B',
          'green-dark': '#00452B',
          'green-light': '#0A7A4E',
          black: '#000000',
          beige: '#C6A984',
          cream: '#FFE5B4',
          grey: '#ECECEC',
          'grey-dark': '#8A8A8A',
        },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
