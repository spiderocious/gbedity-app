import { Pill } from '@gbedity/ui';

// B — hero copy block. The positioning line + subhead. "Game night for the room" drops the
// TV (the medium isn't the product). Accent Orange is celebration-only, so the type carries
// the weight, not orange.
//
// The demo panel and the Join/Host cards are composed alongside this in the screen's entry
// grid (see landing-screen.tsx) so their order can differ between mobile and desktop.
export function HeroCopy() {
  return (
    <div className="text-center lg:text-left">
      <div className="mb-5 flex justify-center lg:justify-start">
        <Pill tone="action">Free · No installs · No accounts</Pill>
      </div>
      <h1 className="mx-auto max-w-[16ch] font-serif text-[44px] font-semibold leading-[1.02] tracking-[-0.02em] text-ink lg:mx-0 lg:text-[60px]">
        Game night for the room.
      </h1>
      <p className="mx-auto mt-4 max-w-[48ch] font-sans text-[16px] leading-[1.5] text-ink-3 lg:mx-0 lg:text-[18px]">
        Phones are the controllers. Eighteen games, from quick quizzes to courtroom
        showdowns. Open it, share a code, play.
      </p>
    </div>
  );
}
