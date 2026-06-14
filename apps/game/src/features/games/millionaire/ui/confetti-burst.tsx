import { useEffect, useState } from 'react';

import Confetti from 'react-confetti';

import { prefersReducedMotion } from './motion.ts';

const BRAND_COLORS = ['#FF8A2A', '#27B973', '#7B4FBF', '#F7C948', '#5BC0EB'];

interface Size {
  readonly width: number;
  readonly height: number;
}

interface ConfettiBurstProps {
  readonly active?: boolean;
  readonly pieces?: number;
}

export function ConfettiBurst({ active = true, pieces = 320 }: ConfettiBurstProps) {
  const [size, setSize] = useState<Size>(() => ({
    width: typeof window === 'undefined' ? 0 : window.innerWidth,
    height: typeof window === 'undefined' ? 0 : window.innerHeight,
  }));

  useEffect(() => {
    function onResize() {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (!active || prefersReducedMotion()) return null;

  return (
    <Confetti
      width={size.width}
      height={size.height}
      recycle={false}
      colors={BRAND_COLORS}
      numberOfPieces={pieces}
      gravity={0.22}
      initialVelocityY={12}
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 90 }}
    />
  );
}
