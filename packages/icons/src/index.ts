// Centralised icon proxy. The rest of the codebase imports from `@icons`
// (aliased to this package in each app's tsconfig + vite config) so the icon
// source can be swapped in one place — currently lucide-react.
//
// Everything lucide exports is re-exported here, so `import { Home } from '@icons'`
// works for any icon in the set.
export * from 'lucide-react';

// The shared icon type, so feature code can type an icon prop without importing
// lucide-react directly.
export type { LucideIcon, LucideProps } from 'lucide-react';
