import { SoloInvestigationScreen } from './screens/solo-screen.tsx';

// Route component for client-driven solo Investigation. The screen self-manages the whole flow
// (draw case → briefing → investigate → accuse → reveal → final) via REST — no params needed.
export function InvestigationSoloRoute() {
  return <SoloInvestigationScreen />;
}
