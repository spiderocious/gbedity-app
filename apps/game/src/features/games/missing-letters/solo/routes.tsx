import { SoloMissingLettersScreen } from './screens/solo-screen.tsx';

// Route component for client-driven solo Missing Letters. The screen self-manages the whole flow
// (start → countdown → play → reveal → final) via REST — no params needed. Config can be passed via
// the launch later; defaults for now.
export function MissingLettersSoloRoute() {
  return <SoloMissingLettersScreen />;
}
