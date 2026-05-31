// Pure string-similarity stack, lifted from wordmaster (word-validation-model.ts). Used for
// near-miss suggestions ("did you mean…") and synonym-tolerant dup handling. No LLM, no I/O.
// Combined score = Levenshtein 0.4 + Jaro 0.3 + Soundex 0.2 + longest-common-substring 0.1.

const levenshteinDistance = (a: string, b: string): number => {
  const m: number[][] = Array.from({ length: b.length + 1 }, () => Array<number>(a.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) m[0]![i] = i;
  for (let j = 0; j <= b.length; j += 1) m[j]![0] = j;
  for (let j = 1; j <= b.length; j += 1) {
    for (let i = 1; i <= a.length; i += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      m[j]![i] = Math.min(m[j]![i - 1]! + 1, m[j - 1]![i]! + 1, m[j - 1]![i - 1]! + cost);
    }
  }
  return m[b.length]![a.length]!;
};

const levenshteinSimilarity = (a: string, b: string): number => {
  const max = Math.max(a.length, b.length);
  return max === 0 ? 1 : 1 - levenshteinDistance(a, b) / max;
};

const jaroSimilarity = (a: string, b: string): number => {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  const window = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const am = new Array<boolean>(a.length).fill(false);
  const bm = new Array<boolean>(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i += 1) {
    const start = Math.max(0, i - window);
    const end = Math.min(i + window + 1, b.length);
    for (let j = start; j < end; j += 1) {
      if (bm[j] || a[i] !== b[j]) continue;
      am[i] = true;
      bm[j] = true;
      matches += 1;
      break;
    }
  }
  if (matches === 0) return 0;
  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < a.length; i += 1) {
    if (!am[i]) continue;
    while (!bm[k]) k += 1;
    if (a[i] !== b[k]) transpositions += 1;
    k += 1;
  }
  return (matches / a.length + matches / b.length + (matches - transpositions / 2) / matches) / 3;
};

export const soundex = (str: string): string => {
  if (str.length === 0) return '0000';
  const code = str.toUpperCase().charAt(0);
  const tail = str
    .toUpperCase()
    .slice(1)
    .replace(/[AEIOUYHW]/g, '')
    .replace(/[BFPV]/g, '1')
    .replace(/[CGJKQSXZ]/g, '2')
    .replace(/[DT]/g, '3')
    .replace(/[L]/g, '4')
    .replace(/[MN]/g, '5')
    .replace(/[R]/g, '6')
    .replace(/(.)\1+/g, '$1')
    .slice(0, 3);
  return `${code}${tail}000`.slice(0, 4);
};

const longestCommonSubstringLen = (a: string, b: string): number => {
  const m: number[][] = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0));
  let longest = 0;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      if (a[i - 1] === b[j - 1]) {
        m[i]![j] = m[i - 1]![j - 1]! + 1;
        if (m[i]![j]! > longest) longest = m[i]![j]!;
      }
    }
  }
  return longest;
};

const lcsSimilarity = (a: string, b: string): number => {
  const max = Math.max(a.length, b.length);
  return max === 0 ? 1 : longestCommonSubstringLen(a, b) / max;
};

// Combined similarity in [0,1] — the wordmaster weighting.
export const similarity = (a: string, b: string): number => {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return (
    levenshteinSimilarity(x, y) * 0.4 +
    jaroSimilarity(x, y) * 0.3 +
    (soundex(x) === soundex(y) ? 1 : 0) * 0.2 +
    lcsSimilarity(x, y) * 0.1
  );
};
