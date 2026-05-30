import { Banner, InlineAlert, Toast } from '@gbedity/ui';

import { PageHead, RefBlock, RefRow } from './preview-canvas.tsx';

export function FeedbackPart() {
  return (
    <div>
      <PageHead
        index="30 / FEEDBACK"
        title="Toast · Banner · InlineAlert"
        subtitle="@gbedity/ui · feedback"
      />

      <p className="mb-6 max-w-[64ch] text-[13px] leading-[1.65] text-ink-3">
        Three weights of feedback. <strong>Toast</strong> is the brief floating pill — appears
        and fades; the DrawerService stacks them via createPortal. <strong>Banner</strong>{' '}
        lives in a screen, persistent until acted on. <strong>InlineAlert</strong> is the small
        in-form variant.
      </p>

      <RefBlock title="Toast · tones">
        <RefRow label="tones">
          <Toast tone="success">Ada joined the room</Toast>
          <Toast>Configuration saved</Toast>
        </RefRow>
        <RefRow label="more tones">
          <Toast tone="warn">Funmi reconnecting…</Toast>
          <Toast tone="danger">Kemi left the room</Toast>
          <Toast tone="info">Round 3 starts in 3s</Toast>
        </RefRow>
        <RefRow label="with action">
          <Toast action={{ label: 'Undo', onClick: () => undefined }}>
            Drawing tools updated
          </Toast>
          <Toast tone="success" action={{ label: 'Skip', onClick: () => undefined }}>
            Round 3 starts in 3s
          </Toast>
        </RefRow>
      </RefBlock>

      <div className="h-6" />

      <RefBlock title="Banner · in-page persistent feedback">
        <div className="flex flex-col gap-3">
          <Banner
            tone="info"
            title="Open the display URL on your TV"
            description="Phones make better controllers than displays. Scan the QR or visit gbedity.app/display from any browser."
            cta={{ label: 'Open ↗', onClick: () => undefined }}
          />
          <Banner
            tone="warn"
            title="Connection unstable"
            description="Two players have dropped to 3G. Game state will keep, but inputs may stutter."
            cta={{ label: 'Pause', onClick: () => undefined }}
          />
          <Banner
            tone="danger"
            title="Room server reconnecting"
            description="Last 30 seconds of state may be lost. Players will see a brief 'reconnecting' indicator on their phones."
            cta={{ label: 'Dismiss', onClick: () => undefined }}
          />
          <Banner
            tone="success"
            title="League queue ready"
            description="3 games queued · 33 minutes estimated · weighted ×1 / ×2 / ×1."
            cta={{ label: 'Start', onClick: () => undefined }}
          />
        </div>
      </RefBlock>

      <div className="h-6" />

      <RefBlock title="InlineAlert · compact, in-form">
        <RefRow label="info">
          <InlineAlert tone="info">Six characters. We've removed easy-to-confuse ones (O, 0, I, 1).</InlineAlert>
        </RefRow>
        <RefRow label="success">
          <InlineAlert tone="success">Available!</InlineAlert>
        </RefRow>
        <RefRow label="warn">
          <InlineAlert tone="warn">This nickname is already taken in this room.</InlineAlert>
        </RefRow>
        <RefRow label="danger">
          <InlineAlert tone="danger">That room code doesn't exist.</InlineAlert>
        </RefRow>
      </RefBlock>
    </div>
  );
}
