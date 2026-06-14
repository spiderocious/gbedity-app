import { cn } from '@gbedity/ui';

import type { MockTranscript } from '../preview/mock-case.ts';

// An interview transcript. `TranscriptBody` is the readable Q&A for the accordion; the section builds
// the summary row (the interview title). Questions sit muted, answers in a tinted bubble.

export function TranscriptBody({ transcript }: { readonly transcript: MockTranscript }) {
  return (
    <div className="flex flex-col gap-3">
      {transcript.lines.map((line, i) => (
        <div key={i} className="flex flex-col gap-[2px]">
          <span className="font-sans text-[10px] font-extrabold uppercase tracking-[0.1em] text-ink-4">{line.speaker}</span>
          <p
            className={cn(
              'max-w-[90%] rounded-[14px] px-3 py-2 font-sans text-[13px] leading-[1.5]',
              line.role === 'a' ? 'bg-action-soft text-ink-2' : 'bg-mist-soft text-ink-2',
            )}
          >
            {line.text}
          </p>
        </div>
      ))}
    </div>
  );
}
