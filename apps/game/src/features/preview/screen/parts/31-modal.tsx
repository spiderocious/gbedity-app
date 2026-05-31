import { useState } from 'react';

import { Avatar, Button, CriticalModal, LobbyRow, Modal, Pill } from '@gbedity/ui';

import { PageHead, RefBlock, RefRow } from './preview-canvas.tsx';

export function ModalPart() {
  const [standardOpen, setStandardOpen] = useState(false);
  const [destructiveOpen, setDestructiveOpen] = useState(false);
  const [bootOpen, setBootOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);

  return (
    <div>
      <PageHead
        index="31 / FEEDBACK"
        title="Modal · CriticalModal"
        subtitle="@gbedity/ui · modal"
      />

      <p className="mb-6 max-w-[64ch] text-[13px] leading-[1.65] text-ink-3">
        Three intents. <strong>Standard</strong> for soft decisions (primary confirm).{' '}
        <strong>Destructive</strong> for reversible-but-loud actions (red action button).{' '}
        <strong>CriticalModal</strong> for irreversible — boot player, end session mid-game.
        Critical requires typing the literal action; colour alone never carries the weight.
      </p>

      <RefBlock title="Open the modals">
        <RefRow label="standard">
          <Button onClick={() => setStandardOpen(true)}>Open standard modal</Button>
        </RefRow>
        <RefRow label="destructive">
          <Button variant="secondary" onClick={() => setDestructiveOpen(true)}>
            Skip a turn
          </Button>
        </RefRow>
        <RefRow label="critical · boot player">
          <Button variant="danger" onClick={() => setBootOpen(true)}>
            Boot Kemi
          </Button>
        </RefRow>
        <RefRow label="critical · end session">
          <Button variant="danger" onClick={() => setEndOpen(true)}>
            End session
          </Button>
        </RefRow>
      </RefBlock>

      <Modal
        open={standardOpen}
        onClose={() => setStandardOpen(false)}
        onConfirm={() => setStandardOpen(false)}
        title="Use a different display?"
        description="You've already opened the display URL once. Opening it again will move the game state to the new device."
        confirmLabel="Open here"
      />

      <Modal
        open={destructiveOpen}
        onClose={() => setDestructiveOpen(false)}
        onConfirm={() => setDestructiveOpen(false)}
        intent="danger"
        title="Skip Funmi's turn?"
        description="She'll lose her chance this round. The next player will go automatically."
        confirmLabel="Skip turn"
      >
        <LobbyRow
          initial="F"
          seat={3}
          name="Funmi"
          meta="Currently on the clock · 0:14 left"
        />
      </Modal>

      <CriticalModal
        open={bootOpen}
        onClose={() => setBootOpen(false)}
        onConfirm={() => setBootOpen(false)}
        title="Boot Kemi from the room?"
        description="She'll be removed from this room immediately. Her score will be preserved, but she'll need a new join link to come back."
        confirmPhrase="Kemi"
        confirmPrompt={
          <>
            Type <strong className="font-serif text-[14px] font-semibold text-ink">Kemi</strong>{' '}
            to confirm
          </>
        }
        confirmLabel="Boot Kemi"
      >
        <div className="my-4 flex items-center gap-3 rounded-[14px] bg-canvas px-4 py-[14px]">
          <Avatar initial="K" seat={3} size="lg" />
          <div>
            <div className="font-serif text-[18px] font-semibold text-ink">Kemi</div>
            <div className="text-[12px] text-ink-3">Joined 4m ago · score 920</div>
          </div>
        </div>
      </CriticalModal>

      <CriticalModal
        open={endOpen}
        onClose={() => setEndOpen(false)}
        onConfirm={() => setEndOpen(false)}
        title="End the session?"
        description="There are 3 games left in the league. Ending now discards the queue and shows the current league standings as final. Players will be disconnected."
        confirmPhrase="END SESSION"
        confirmPrompt={
          <>
            Type{' '}
            <strong className="font-serif text-[14px] font-semibold text-ink">END SESSION</strong>{' '}
            to confirm
          </>
        }
        confirmLabel="End session now"
      >
        <div className="my-4 flex items-center justify-between rounded-[14px] bg-canvas px-4 py-[14px]">
          <div>
            <div className="font-serif text-[18px] font-semibold text-ink">Friday game night</div>
            <div className="text-[12px] text-ink-3">League · 4 of 7 games complete · 4 players</div>
          </div>
          <Pill tone="special">League</Pill>
        </div>
      </CriticalModal>
    </div>
  );
}
