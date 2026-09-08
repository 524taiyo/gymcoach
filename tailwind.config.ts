import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      fontFamily: {
        sans: [
          'var(--font-sans)',
          'var(--font-sans-jp)',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Hiragino Sans',
          'Noto Sans JP',
          'sans-serif',
        ],
      },
      boxShadow: {
        // Hairline elevation for inputs and outline buttons.
        xs: '0 1px 2px 0 rgb(15 23 42 / 0.04)',
        // Card surface: a tight contact shadow plus a soft ambient one.
        card: '0 1px 2px rgb(15 23 42 / 0.04), 0 4px 16px -8px rgb(15 23 42 / 0.10)',
      },
      colors: {
        'border-strong': 'hsl(var(--border-strong))',
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      minHeight: {
        // Minimum tap target, deliberately 4rem (64px) rather than the usual
        // 44px: these are pressed mid-set with gloved or chalky hands. The size
        // has a cost worth knowing. Three tap targets in a card's trailing
        // column is what starved the exercise name at 400px (#330, #336), so
        // widen the row or drop a control rather than shrinking this.
        tap: '4rem',
      },
      minWidth: {
        tap: '4rem',
      },
      fontSize: {
        // For the oversized rest-timer readout.
        timer: ['6rem', { lineHeight: '1', fontWeight: '700' }],
      },
    },
  },
  plugins: [typography],
};

export default config;
