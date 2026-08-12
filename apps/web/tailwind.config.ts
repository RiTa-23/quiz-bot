import type { Config } from 'tailwindcss'

/**
 * クイズ番組をモチーフにした配色。深い紺の盤面に金の差し色、地は生なり白。
 * Tailwind既定のindigo/grayは意図的に使わない（どのサービスとも似た見た目になるため）。
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#EEF1F7',
          100: '#D3DAE8',
          200: '#A7B5D1',
          300: '#6E82AB',
          600: '#1C3566',
          700: '#132649',
          800: '#0E1D39',
          900: '#0B1B3A',
          950: '#071228',
        },
        gold: {
          100: '#FBF0D3',
          200: '#F5DFA4',
          400: '#E8B341',
          500: '#D69C22',
          600: '#B07D14',
        },
        paper: {
          DEFAULT: '#F7F5F0',
          raised: '#FFFFFF',
          sunken: '#EFEBE2',
          line: '#DED8CB',
        },
        correct: '#2E9E6B',
        wrong: '#C8452F',
      },
      fontFamily: {
        sans: [
          '"Hiragino Kaku Gothic ProN"',
          '"Noto Sans JP"',
          '"Yu Gothic Medium"',
          'system-ui',
          'sans-serif',
        ],
      },
      borderRadius: {
        // 角丸は控えめにして「盤面」の硬さを出す
        DEFAULT: '4px',
        md: '4px',
        lg: '6px',
      },
      boxShadow: {
        panel: '0 1px 0 0 #DED8CB, 0 2px 8px -4px rgba(11, 27, 58, 0.18)',
        raised: '0 2px 0 0 #B07D14',
      },
    },
  },
  plugins: [],
} satisfies Config
