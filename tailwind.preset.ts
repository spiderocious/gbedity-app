import type { Config } from 'tailwindcss';

// Shared Tailwind theme for Gbedity. Each app/package's tailwind.config.ts pulls this in
// via `presets: [gbedityPreset]` so tokens stay defined in one place. Template defaults —
// extend the palette/typography as the game's design system grows.
const preset: Omit<Config, 'content'> = {
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#4f46e5',
          hover: '#4338ca',
          fg: '#ffffff',
        },
        ink: {
          DEFAULT: '#1f2937',
          secondary: '#4b5563',
        },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default preset;
