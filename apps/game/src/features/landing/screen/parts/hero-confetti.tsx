import { useEffect, useState } from "react";
import Confetti from "react-confetti";

// A celebratory confetti layer on the hero, via react-confetti. Brand palette only.
// Suppressed entirely under prefers-reduced-motion. Window dimensions are tracked on
// resize so the canvas always fills the viewport.

// Brand colours (accent / action / special / sun / info) — celebration, on-palette.
const BRAND_COLORS = ["#FF8A2A", "#27B973", "#7B4FBF", "#F7C948", "#5BC0EB"];

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

interface Size {
  readonly width: number;
  readonly height: number;
}

export function HeroConfetti() {
  const [size, setSize] = useState<Size>(() => ({
    width: typeof window === "undefined" ? 0 : window.innerWidth,
    height: typeof window === "undefined" ? 0 : window.innerHeight,
  }));

  useEffect(() => {
    function onResize() {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (prefersReducedMotion()) return null;

  return (
    <Confetti
      width={size.width}
      height={size.height}
      recycle={true}
      colors={BRAND_COLORS}
      numberOfPieces={200}
      gravity={0.2}
      // react-confetti's canvas defaults to position:absolute, so it only covers its
      // parent box (and gets clipped by the hero's overflow-hidden). Pin it to the
      // viewport as a top-level overlay so confetti falls across the whole page.
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 90,
      }}
    />
  );
}
