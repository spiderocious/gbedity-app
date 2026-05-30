import type { Config } from 'tailwindcss';

// Shared Tailwind theme for Gbedity — the "bright-room game-night" stance.
//
// Source of truth for the visual spec is the Studio at:
//   /Users/feranmi/codebases/2026/dockito/design-system/projects/gbedity/preview/_foundation.css
//
// Every app's tailwind.config.ts pulls this preset in and globs packages/ui/src/**,
// so a class used in the library gets compiled in the consuming app.
//
// Token philosophy:
//   - Three colour layers: stage (cobalt frame) > canvas (mint zone) > surface (white card)
//   - Ink is forest, never black
//   - Action green for forward motion; accent orange reserved for celebration moments
//   - Stage frame appears only on post-game; operator-everyday lives on canvas
const preset: Omit<Config, 'content'> = {
  theme: {
    extend: {
      colors: {
        // Stage architecture
        stage: {
          DEFAULT: '#2D5BFF',
          deep: '#1E3FB8',
          tint: '#D8E1FF',
        },
        canvas: {
          DEFAULT: '#C8E8DA',
          tint: '#D9EFE3',
          deep: '#ABDBC6',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          soft: '#FAFBFA',
        },
        // Ink — forest, never black
        ink: {
          DEFAULT: '#1F6B4A',
          2: '#2F5C46',
          3: '#536A62',
          4: '#9CB3AB',
          5: '#C7D6CF',
        },
        // Action — forward motion
        action: {
          DEFAULT: '#27B973',
          deep: '#1F9A60',
          soft: '#DFF5EA',
          edge: '#B8E6D0',
        },
        // Accent — celebration & brand identity only
        accent: {
          DEFAULT: '#FF8A2A',
          deep: '#E8731A',
          soft: '#FFE5CD',
        },
        // Semantic state
        danger: {
          DEFAULT: '#E85A4F',
          deep: '#C44035',
          soft: '#FBE0DD',
          edge: '#F2B5AF',
        },
        warn: {
          DEFAULT: '#F7C948',
          deep: '#D9A813',
          soft: '#FEF3D1',
          edge: '#F0DC8E',
        },
        info: {
          DEFAULT: '#5BC0EB',
          soft: '#E0F2FB',
        },
        special: {
          DEFAULT: '#7B4FBF',
          soft: '#ECE2F8',
        },
        // Neutral mist
        mist: {
          soft: '#F2F5F4',
          mid: '#9CB3AB',
          deep: '#536A62',
        },
        // Game category tints (used on catalogue tile tops)
        category: {
          casual: '#27B973', // action
          brain: '#2D5BFF', // stage
          party: '#7B4FBF', // special
          immersive: '#1A1714', // ink-deep (near-black, warm)
        },
      },
      fontFamily: {
        // Fraunces handles emotional weight: numerals, headlines, game titles, celebration.
        serif: [
          '"Fraunces Variable"',
          'Fraunces',
          'Georgia',
          'serif',
        ],
        // Nunito does every UI surface: buttons, labels, body, rows, pills.
        sans: [
          'Nunito',
          'system-ui',
          '-apple-system',
          'sans-serif',
        ],
      },
      fontVariationSettings: {
        // Fraunces axes — max softness, opsz scales with size.
        soft: '"SOFT" 100, "opsz" 48',
        'soft-display': '"SOFT" 100, "opsz" 144',
      },
      borderRadius: {
        // Nothing is sharp — explicit scale matching the foundation CSS.
        'btn-sm': '16px',
        btn: '20px',
        'btn-lg': '24px',
        input: '16px',
        card: '20px',
        'card-lg': '28px',
        stage: '32px',
      },
      spacing: {
        // 8px grid extras; default Tailwind spacing already covers most.
        'screen-pad': '18px',
      },
      letterSpacing: {
        display: '-0.02em',
        h: '-0.01em',
        label: '0.12em',
        overline: '0.14em',
      },
      lineHeight: {
        display: '0.95',
      },
      boxShadow: {
        'lift-card': '0 8px 24px rgba(31, 107, 74, 0.08)',
        'lift-modal': '0 24px 64px rgba(31, 107, 74, 0.18)',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
    },
  },
  plugins: [],
};

export default preset;
