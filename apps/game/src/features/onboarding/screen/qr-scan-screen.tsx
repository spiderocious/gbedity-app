import { useEffect, useState } from 'react';

import { DrawerService } from '@gbedity/ui';
import { Keyboard } from '@icons';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '../../../shared/constants/routes.ts';

// §1.4 — QR scan mock. No real camera. After 2s, simulate a successful scan and route to
// the nickname screen.
export function QrScanScreen() {
  const navigate = useNavigate();
  const [found, setFound] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFound(true);
      DrawerService.toast('Found it', { tone: 'success' });
      window.setTimeout(() => navigate(ROUTES.JOIN_NICKNAME), 700);
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="relative min-h-screen bg-ink">
      {/* Mock camera viewport */}
      <div className="absolute inset-0 bg-gradient-to-b from-ink-2 to-ink" aria-hidden="true" />
      <div className="relative flex min-h-screen flex-col items-center justify-center gap-6 px-6">
        <div
          className={`flex h-56 w-56 items-center justify-center rounded-card-lg border-4 transition-colors duration-200 ${
            found ? 'border-action' : 'border-action/60'
          }`}
        >
          <svg viewBox="0 0 80 80" className="h-32 w-32 text-white/80" fill="currentColor" aria-hidden="true">
            <rect x="6" y="6" width="22" height="22" rx="3" /><rect x="52" y="6" width="22" height="22" rx="3" />
            <rect x="6" y="52" width="22" height="22" rx="3" /><rect x="36" y="36" width="10" height="10" />
            <rect x="52" y="52" width="10" height="10" /><rect x="64" y="64" width="10" height="10" />
          </svg>
        </div>
        <p className="text-center font-sans text-[15px] font-semibold text-white">
          Point your camera at the QR on the shared screen.
        </p>
        <button
          type="button"
          onClick={() => navigate(ROUTES.JOIN)}
          className="inline-flex items-center gap-2 font-sans text-[13px] font-bold uppercase tracking-[0.1em] text-white/80 hover:text-white"
        >
          <Keyboard size={16} aria-hidden="true" /> Type the code instead
        </button>
      </div>
    </div>
  );
}
