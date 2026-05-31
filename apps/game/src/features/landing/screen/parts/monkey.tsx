// Flat-vector monkey — brand-styled (Forest Ink outline, flat fills), deliberately
// face-minimal per branding §5 (no kawaii cheeks, no big smile — two small eyes, a calm
// muzzle). Sits on the top edge of a card and peeks down. Pure SVG; the hop + idle motion
// is driven by the parent RoamingMonkeys (transform), this just draws the character.

export type MonkeyTone = 'ink' | 'special' | 'accent';

interface MonkeyProps {
  readonly size?: number;
  /** Body fill tone. Defaults to forest ink. */
  readonly tone?: MonkeyTone;
}

const BODY: Record<MonkeyTone, string> = {
  ink: '#2F5C46',
  special: '#7B4FBF',
  accent: '#E8731A',
};

const OUTLINE = '#1F6B4A';
const FACE = '#FBE9D2';
const EAR_INNER = '#FBE9D2';

export function Monkey({ size = 56, tone = 'ink' }: MonkeyProps) {
  const body = BODY[tone];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      role="presentation"
    >
      {/* tail — curls down off the perch */}
      <path
        d="M16 40 C6 44 6 56 16 56"
        stroke={OUTLINE}
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
      {/* ears */}
      <circle cx="20" cy="22" r="8" fill={body} stroke={OUTLINE} strokeWidth="2.5" />
      <circle cx="44" cy="22" r="8" fill={body} stroke={OUTLINE} strokeWidth="2.5" />
      <circle cx="20" cy="22" r="3.5" fill={EAR_INNER} />
      <circle cx="44" cy="22" r="3.5" fill={EAR_INNER} />
      {/* body */}
      <path
        d="M18 42 C18 32 24 27 32 27 C40 27 46 32 46 42 C46 50 40 54 32 54 C24 54 18 50 18 42 Z"
        fill={body}
        stroke={OUTLINE}
        strokeWidth="2.5"
      />
      {/* head */}
      <circle cx="32" cy="26" r="15" fill={body} stroke={OUTLINE} strokeWidth="2.5" />
      {/* face patch */}
      <ellipse cx="32" cy="29" rx="10" ry="9" fill={FACE} />
      {/* eyes — two small calm dots, no smile (face-minimal, not kawaii) */}
      <circle cx="28" cy="27" r="1.8" fill={OUTLINE} />
      <circle cx="36" cy="27" r="1.8" fill={OUTLINE} />
      {/* muzzle */}
      <ellipse cx="32" cy="33" rx="3.5" ry="2.2" fill="none" stroke={OUTLINE} strokeWidth="1.6" />
      {/* hands gripping the perch edge */}
      <circle cx="20" cy="48" r="4" fill={body} stroke={OUTLINE} strokeWidth="2.2" />
      <circle cx="44" cy="48" r="4" fill={body} stroke={OUTLINE} strokeWidth="2.2" />
    </svg>
  );
}
