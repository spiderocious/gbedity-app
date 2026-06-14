import { SoloWwtbamScreen } from './screens/solo-screen.tsx';

// Route component for client-driven solo WWTBAM. The screen self-manages the whole flow
// (start → countdown → play → reveal → final) via REST — no params needed. Config can be passed
// from the launch later; defaults for now.
export function WwtbamSoloRoute() {
  return <SoloWwtbamScreen />;
}
