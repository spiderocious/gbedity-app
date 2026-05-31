import { useState, type ReactElement } from 'react';

import { useNavigate } from 'react-router-dom';

import { StageFrameTransition } from './stage-frame-transition.tsx';

// Convenience around StageFrameTransition: returns a `go(path)` that plays the cobalt
// curtain then navigates at full cover, plus the element to render. Keeps every screen
// from re-implementing the active/midpoint/done state.

export interface StageNav {
  readonly go: (path: string) => void;
  readonly curtain: ReactElement;
}

export function useStageNav(): StageNav {
  const navigate = useNavigate();
  const [active, setActive] = useState(false);
  const [target, setTarget] = useState<string>('');

  function go(path: string) {
    setTarget(path);
    setActive(true);
  }

  const curtain = (
    <StageFrameTransition
      active={active}
      onMidpoint={() => {
        if (target !== '') navigate(target);
      }}
      onDone={() => setActive(false)}
    />
  );

  return { go, curtain };
}
