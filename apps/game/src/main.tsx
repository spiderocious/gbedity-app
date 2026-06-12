import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app.tsx';
import { log } from './shared/observability/logger.ts';
import { LogEvent } from './shared/observability/events.ts';

import '@gbedity/ui/styles.css';
import './styles.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Missing #root element in index.html');

// NOTE when reading a capture: React.StrictMode double-invokes effects in dev, so each component's
// ui_mounted/ui_unmounted will appear twice on first mount. A SINGLE double is StrictMode, not the
// remount bug — look for repeated mount cycles tied to flow_backend_id_changed / flow_resolved flips.
log.event(LogEvent.APP_BOOTED, { env: import.meta.env.MODE }, { component: 'main' });

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
