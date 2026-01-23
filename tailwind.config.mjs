/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        // redcudi Brand Palette
        brand: {
          // Teal family (primary)
          teal: {
            dark: '#428989',
            base: '#7cdede',
            light: '#b1f2f2',
          },
          // Green family (secondary)
          green: {
            dark: '#a2d164',
            base: '#c8f88a',
            light: '#dffcb8',
          },
          // Purple family (accent)
          purple: {
            dark: '#60579f',
            base: '#978ee6',
            light: '#c3bcf5',
          },
          // Orange/Peach family (highlight)
          orange: {
            dark: '#e5a46e',
            base: '#ffc18e',
            light: '#ffdabb',
          },
        },
        // Neutral colors (grays)
        neutral: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
        },
        // LGBTQ+ Pride colors
        pride: {
          red: '#e40303',
          orange: '#ff8c00',
          yellow: '#ffff00',
          green: '#008026',
          blue: '#002bff',
          purple: '#750787',
          trans: {
            pink: '#5bcefa',
            white: '#ffffff',
            blue: '#f5a9b8',
          },
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Poppins', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

