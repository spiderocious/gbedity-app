import type { Config } from 'tailwindcss';

import preset from '../../tailwind.preset.js';

export default {
  presets: [preset],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    // Compile classes used by shared packages too.
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
} satisfies Config;
