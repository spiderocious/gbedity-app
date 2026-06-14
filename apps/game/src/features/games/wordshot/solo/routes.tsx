import { SoloWordshotScreen } from './screens/solo-screen.tsx';

// Route component for client-driven solo Wordshot. The screen self-manages the whole flow
// (start → countdown → play → reveal → final) via REST — no params needed.
export function WordshotSoloRoute() {
  return <SoloWordshotScreen />;
}
