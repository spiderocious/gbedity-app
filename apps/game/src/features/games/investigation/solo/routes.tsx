import { useLocation } from 'react-router-dom';

import { readSoloConfig } from '../../solo-entry.ts';
import { SoloInvestigationScreen } from './screens/solo-screen.tsx';

// Route component for client-driven solo Investigation. The chosen config (time, caseKey) rides in
// the `cfg` URL param (set by the configure screen); the screen self-manages the rest via REST.
export function InvestigationSoloRoute() {
  const { search } = useLocation();
  const config = readSoloConfig(search);
  return <SoloInvestigationScreen {...(config !== undefined ? { config } : {})} />;
}
