import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        /* =========================
           Chalkboard palette
           Source: attempt/[attemptId]/chalkboard.module.css
           Values live as CSS variables in src/styles/global.css
        ========================= */
        chalk: {
          DEFAULT: 'var(--chalk)',
          dim: 'var(--chalk-dim)',
          faint: 'var(--chalk-faint)',
          yellow: 'var(--chalk-yellow)',
          pink: 'var(--chalk-pink)',
          green: 'var(--chalk-green)',
          blue: 'var(--chalk-blue)',
        },
        board: {
          DEFAULT: 'var(--board)',
          dark: 'var(--board-dark)',
        },
        wood: {
          DEFAULT: 'var(--wood)',
          dark: 'var(--wood-dark)',
        },
        wall: {
          DEFAULT: 'var(--wall)',
          stripe: 'var(--wall-stripe)',
        },
        paper: {
          DEFAULT: 'var(--paper)',
          ink: 'var(--ink-paper)',
        },
        ink: {
          wood: 'var(--ink-wood)',
          'on-yellow': 'var(--ink-on-yellow)',
        },
      },

      /* =========================
         Typography
         chalk  = Patrick Hand (everything written on the board)
         script = Dancing Script (page titles, big numbers)
         sans   = Inter (data tables, inputs, long teacher-side text)
         mono   = JetBrains Mono (class codes, tokens, IDs)
      ========================= */
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        chalk: ['var(--font-chalk)', '\'Comic Sans MS\'', 'cursive'],
        script: ['var(--font-chalk-script)', 'var(--font-chalk)', 'cursive'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },

      fontSize: {
        'xs': ['12px', { lineHeight: '16px' }],
        'sm': ['14px', { lineHeight: '20px' }],
        'base': ['16px', { lineHeight: '24px' }],
        'lg': ['18px', { lineHeight: '28px' }],
        'xl': ['20px', { lineHeight: '30px' }],
        '2xl': ['24px', { lineHeight: '34px' }],
        '3xl': ['30px', { lineHeight: '40px' }],
      },

      /* =========================
         Custom breakpoints (SaaS dashboard)
      ========================= */
      screens: {
        'xs': '360px',
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1440px',
      },

      /* =========================
         Spacing (Dashboard friendly)
      ========================= */
      spacing: {
        18: '4.5rem',
        22: '5.5rem',
        26: '6.5rem',
        30: '7.5rem',
        // Tap target tối thiểu cho mobile
        touch: '44px',
      },

      /* =========================
         Border Radius
      ========================= */
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
      },

      /* =========================
         Shadows (Framer-style depth)
      ========================= */
      boxShadow: {
        // .tokenInput:focus ring (chalk on a board casts no drop shadow)
        focus: '0 0 0 4px rgba(246,226,127,0.35)',
      },

      /* =========================
         Transitions & Motion
      ========================= */
      transitionTimingFunction: {
        soft: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },

      transitionDuration: {
        fast: '150ms',
        normal: '250ms',
        slow: '400ms',
      },

      /* =========================
         Z-index Scale (Layering)
      ========================= */
      zIndex: {
        base: 0,
        dropdown: 10,
        sticky: 20,
        overlay: 30,
        sidebar: 50,
        modal: 60, // .overlay in chalkboard.module.css
        popover: 64,
        tooltip: 66,
        toast: 70,
      },

      /* =========================
         Opacity Scale
      ========================= */
      opacity: {
        disabled: 0.5,
        hover: 0.8,
        overlay: 0.4,
        subtle: 0.1,
        medium: 0.2,
        strong: 0.3,
      },

      /* =========================
         Container Max-widths
      ========================= */
      maxWidth: {
        container: '1280px',
        content: '1024px',
      },

      /* =========================
         Animation Presets
      ========================= */
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },

      animation: {
        fadeIn: 'fadeIn 150ms ease-out',
        slideUp: 'slideUp 200ms ease-out',
        slideDown: 'slideDown 200ms ease-out',
        scaleIn: 'scaleIn 150ms ease-out',
      },
    },
  },
  plugins: [],
};
export default config;
