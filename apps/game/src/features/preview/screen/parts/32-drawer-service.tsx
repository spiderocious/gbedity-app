import { Avatar, Button, DrawerService, Pill, Score, type ToastPosition } from '@gbedity/ui';

import { PageHead, RefBlock, RefRow } from './preview-canvas.tsx';

const TOAST_POSITIONS: readonly ToastPosition[] = [
  'top-left',
  'top-center',
  'top-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
];

export function DrawerServicePart() {
  return (
    <div>
      <PageHead
        index="32 / FEEDBACK"
        title="DrawerService"
        subtitle="@gbedity/ui · drawer · imperative singleton"
      />

      <p className="mb-6 max-w-[64ch] text-[13px] leading-[1.65] text-ink-3">
        Call from anywhere — no props, no context, no Provider. Mount{' '}
        <code>&lt;ToastHost /&gt;</code>, <code>&lt;BannerHost /&gt;</code>, and{' '}
        <code>&lt;ModalHost /&gt;</code> once at the app root (already done in{' '}
        <code>app.tsx</code>), then trigger toasts, banners, and modals from any callback.
      </p>

      <RefBlock title="Toast — auto-dismissing, swipe to dismiss">
        <RefRow label="default · 3.5s">
          <Button onClick={() => DrawerService.toast('Configuration saved')}>
            Show default toast
          </Button>
        </RefRow>
        <RefRow label="tones">
          <Button
            variant="celebrate"
            onClick={() => DrawerService.toast('Ada joined the room', { tone: 'success' })}
          >
            Success
          </Button>
          <Button
            variant="secondary"
            onClick={() => DrawerService.toast('Funmi reconnecting…', { tone: 'warn' })}
          >
            Warn
          </Button>
          <Button
            variant="danger"
            onClick={() => DrawerService.toast('Kemi left the room', { tone: 'danger' })}
          >
            Danger
          </Button>
        </RefRow>
        <RefRow label="with action">
          <Button
            onClick={() =>
              DrawerService.toast('Drawing tools updated', {
                action: { label: 'Undo', onClick: () => DrawerService.toast('Reverted') },
              })
            }
          >
            With Undo
          </Button>
        </RefRow>
        <RefRow label="sticky · cannot dismiss or swipe">
          <Button
            variant="secondary"
            onClick={() =>
              DrawerService.toast('Network unstable — staying visible until resolved', {
                tone: 'warn',
                sticky: true,
                position: 'top-right',
              })
            }
          >
            Show sticky toast
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              const id = DrawerService.toast('You can only kill me via the service', {
                tone: 'danger',
                sticky: true,
                position: 'top-center',
              });
              setTimeout(() => DrawerService.dismissToast(id), 4000);
            }}
          >
            Sticky · dismissed by service after 4s
          </Button>
        </RefRow>
        <RefRow label="custom duration">
          <Button
            onClick={() =>
              DrawerService.toast('This one stays for 10 seconds', {
                tone: 'info',
                durationMs: 10000,
              })
            }
          >
            10-second toast
          </Button>
        </RefRow>
      </RefBlock>

      <div className="h-6" />

      <RefBlock title="Toast positions · 6 zones">
        <p className="mb-3 max-w-[60ch] text-[12px] text-ink-3">
          Toasts can land in any of six zones. Stacks within a zone reverse direction so the
          newest sits closest to the screen edge.
        </p>
        <div className="grid grid-cols-3 gap-3">
          {TOAST_POSITIONS.map((pos) => (
            <Button
              key={pos}
              variant="secondary"
              size="sm"
              onClick={() =>
                DrawerService.toast(pos, { tone: 'info', position: pos })
              }
            >
              {pos}
            </Button>
          ))}
        </div>
      </RefBlock>

      <div className="h-6" />

      <RefBlock title="Banner — persistent strip at top or bottom">
        <RefRow label="default · top · sticky">
          <Button
            onClick={() =>
              DrawerService.banner('Open the display URL on your TV', {
                tone: 'info',
                description:
                  'Phones make better controllers than displays. Scan the QR or visit gbedity.app/display.',
                cta: {
                  label: 'Open ↗',
                  onClick: () => DrawerService.toast('Display opened', { tone: 'success' }),
                },
              })
            }
          >
            Show info banner
          </Button>
        </RefRow>
        <RefRow label="warn / danger / success">
          <Button
            variant="secondary"
            onClick={() =>
              DrawerService.banner('Connection unstable', {
                tone: 'warn',
                description: 'Two players have dropped to 3G. Inputs may stutter.',
                cta: { label: 'Pause', onClick: () => undefined },
              })
            }
          >
            Warn
          </Button>
          <Button
            variant="danger"
            onClick={() =>
              DrawerService.banner('Room server reconnecting', {
                tone: 'danger',
                description: 'Last 30 seconds of state may be lost.',
              })
            }
          >
            Danger
          </Button>
          <Button
            variant="celebrate"
            onClick={() =>
              DrawerService.banner('League queue ready', {
                tone: 'success',
                description: '3 games queued · 33 minutes estimated.',
                cta: {
                  label: 'Start',
                  onClick: () => DrawerService.toast('League started', { tone: 'success' }),
                },
              })
            }
          >
            Success
          </Button>
        </RefRow>
        <RefRow label="bottom · auto-dismiss after 4s">
          <Button
            variant="secondary"
            onClick={() =>
              DrawerService.banner('Saved your draft', {
                tone: 'success',
                position: 'bottom',
                sticky: false,
                durationMs: 4000,
              })
            }
          >
            Bottom · 4s
          </Button>
        </RefRow>
      </RefBlock>

      <div className="h-6" />

      <RefBlock title="Modal — confirm (standard + destructive)">
        <RefRow label="standard">
          <Button
            onClick={() =>
              DrawerService.confirm('Use a different display?', {
                description:
                  "You've already opened the display URL once. Opening it again moves the game state to the new device.",
                confirmLabel: 'Open here',
                onConfirm: () => DrawerService.toast('Display moved', { tone: 'success' }),
              })
            }
          >
            Open standard confirm
          </Button>
        </RefRow>
        <RefRow label="destructive">
          <Button
            variant="secondary"
            onClick={() =>
              DrawerService.confirm("Skip Funmi's turn?", {
                description:
                  "She'll lose her chance this round. The next player will go automatically.",
                confirmLabel: 'Skip turn',
                destructive: true,
                onConfirm: () => DrawerService.toast('Turn skipped', { tone: 'warn' }),
              })
            }
          >
            Open destructive confirm
          </Button>
        </RefRow>
        <RefRow label="sticky · no scrim click, no Escape">
          <Button
            onClick={() =>
              DrawerService.confirm('Please confirm before proceeding', {
                description:
                  'This modal can only be dismissed by clicking a button. Try clicking outside or pressing Escape — neither works.',
                confirmLabel: 'I confirm',
                sticky: true,
                onConfirm: () => DrawerService.toast('Confirmed', { tone: 'success' }),
              })
            }
          >
            Sticky confirm
          </Button>
        </RefRow>
      </RefBlock>

      <div className="h-6" />

      <RefBlock title="Modal — critical (irreversible · type to confirm)">
        <RefRow label="boot player">
          <Button
            variant="danger"
            onClick={() =>
              DrawerService.critical('Boot Kemi from the room?', {
                description:
                  "She'll be removed immediately. Her score is preserved; she'll need a new join link to return.",
                confirmPhrase: 'Kemi',
                confirmPrompt: (
                  <>
                    Type{' '}
                    <strong className="font-serif text-[14px] font-semibold text-ink">Kemi</strong>{' '}
                    to confirm
                  </>
                ),
                confirmLabel: 'Boot Kemi',
                onConfirm: () => DrawerService.toast('Kemi removed', { tone: 'danger' }),
                children: (
                  <div className="my-4 flex items-center gap-3 rounded-[14px] bg-canvas px-4 py-[14px]">
                    <Avatar initial="K" seat={3} size="lg" />
                    <div>
                      <div className="font-serif text-[18px] font-semibold text-ink">Kemi</div>
                      <div className="text-[12px] text-ink-3">Joined 4m ago · score 920</div>
                    </div>
                  </div>
                ),
              })
            }
          >
            Boot Kemi
          </Button>
        </RefRow>
        <RefRow label="end session">
          <Button
            variant="danger"
            onClick={() =>
              DrawerService.critical('End the session?', {
                description:
                  '3 games left in the league. Ending now discards the queue and shows the current standings as final.',
                confirmPhrase: 'END SESSION',
                confirmPrompt: (
                  <>
                    Type{' '}
                    <strong className="font-serif text-[14px] font-semibold text-ink">
                      END SESSION
                    </strong>{' '}
                    to confirm
                  </>
                ),
                confirmLabel: 'End session now',
                onConfirm: () => DrawerService.toast('Session ended', { tone: 'danger' }),
                children: (
                  <div className="my-4 flex items-center justify-between rounded-[14px] bg-canvas px-4 py-[14px]">
                    <div>
                      <div className="font-serif text-[18px] font-semibold text-ink">
                        Friday game night
                      </div>
                      <div className="text-[12px] text-ink-3">
                        League · 4 of 7 games complete · 4 players
                      </div>
                    </div>
                    <Pill tone="special">League</Pill>
                  </div>
                ),
              })
            }
          >
            End session
          </Button>
        </RefRow>
      </RefBlock>

      <div className="h-6" />

      <RefBlock title="Custom modal · arbitrary body, 5 positions">
        <p className="mb-3 max-w-[60ch] text-[12px] text-ink-3">
          The service provides the scrim, position, X close button, and outside-click /
          Escape behavior. The caller provides only the body. All position variants share
          the same dismiss semantics — same as confirm/critical, with the same config props.
        </p>
        <RefRow label="center · default">
          <Button
            onClick={() =>
              DrawerService.openModal(
                <div className="pr-8">
                  <h2 className="m-0 mb-2 font-serif text-[26px] font-semibold tracking-[-0.01em] text-ink">
                    Round 3 winner
                  </h2>
                  <p className="m-0 mb-4 text-[14px] text-ink-3">
                    Ada took it with the longest streak this game. Show the leaderboard, then
                    move on.
                  </p>
                  <div className="rounded-[14px] bg-accent-soft p-4 text-center">
                    <Score value="1,420" size="lg" tone="accent" />
                  </div>
                </div>,
              )
            }
          >
            Center
          </Button>
        </RefRow>
        <RefRow label="bottom sheet">
          <Button
            variant="secondary"
            onClick={() =>
              DrawerService.openModal(
                <div className="pr-8">
                  <h2 className="m-0 mb-2 font-serif text-[24px] font-semibold tracking-[-0.01em] text-ink">
                    Quick actions
                  </h2>
                  <p className="m-0 mb-4 text-[13px] text-ink-3">
                    Bottom sheet — common on mobile. Slides up from the bottom of the
                    viewport.
                  </p>
                  <div className="flex flex-col gap-2">
                    <Button variant="secondary" className="w-full">
                      Pause round
                    </Button>
                    <Button variant="secondary" className="w-full">
                      Skip this player
                    </Button>
                    <Button variant="ghost" className="w-full">
                      Cancel
                    </Button>
                  </div>
                </div>,
                { position: 'bottom' },
              )
            }
          >
            Bottom sheet
          </Button>
        </RefRow>
        <RefRow label="right drawer">
          <Button
            variant="secondary"
            onClick={() =>
              DrawerService.openModal(
                <div className="pr-8">
                  <h2 className="m-0 mb-2 font-serif text-[24px] font-semibold tracking-[-0.01em] text-ink">
                    Player details
                  </h2>
                  <p className="m-0 mb-4 text-[13px] text-ink-3">
                    Right-side drawer — for inspecting a single record or running a focused
                    task without leaving the page.
                  </p>
                  <div className="flex items-center gap-3 rounded-[14px] bg-canvas p-4">
                    <Avatar initial="A" seat={2} size="lg" />
                    <div>
                      <div className="font-serif text-[18px] font-semibold text-ink">Ada</div>
                      <div className="text-[12px] text-ink-3">Joined 4m ago · score 1,420</div>
                    </div>
                  </div>
                </div>,
                { position: 'right' },
              )
            }
          >
            Right drawer
          </Button>
        </RefRow>
        <RefRow label="left drawer">
          <Button
            variant="secondary"
            onClick={() =>
              DrawerService.openModal(
                <div className="pr-8">
                  <h2 className="m-0 mb-2 font-serif text-[24px] font-semibold tracking-[-0.01em] text-ink">
                    Game catalogue
                  </h2>
                  <p className="m-0 text-[13px] text-ink-3">
                    Left-side drawer — for navigation menus, palette filters, history lists.
                  </p>
                </div>,
                { position: 'left' },
              )
            }
          >
            Left drawer
          </Button>
        </RefRow>
        <RefRow label="top sheet · no outside-click">
          <Button
            variant="secondary"
            onClick={() =>
              DrawerService.openModal(
                <div className="pr-8">
                  <h2 className="m-0 mb-2 font-serif text-[24px] font-semibold tracking-[-0.01em] text-ink">
                    Read this first
                  </h2>
                  <p className="m-0 mb-4 text-[13px] text-ink-3">
                    Top sheet — closeOnOutsideClick is off, so only the X dismisses this one.
                    Escape still works.
                  </p>
                  <Pill tone="info">Tip: open this twice to compare</Pill>
                </div>,
                { position: 'top', closeOnOutsideClick: false },
              )
            }
          >
            Top sheet · X-only
          </Button>
        </RefRow>
        <RefRow label="sticky custom · only the body's button dismisses">
          <Button
            variant="danger"
            onClick={() =>
              DrawerService.openModal(
                <div>
                  <h2 className="m-0 mb-2 font-serif text-[24px] font-semibold tracking-[-0.01em] text-ink">
                    Force-restart the round?
                  </h2>
                  <p className="m-0 mb-4 text-[13px] text-ink-3">
                    Sticky — no X, no scrim click, no Escape. The only way out is the buttons
                    below. Use for moments where dismissal would lose state.
                  </p>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => DrawerService.closeModal()}>
                      Cancel
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => {
                        DrawerService.closeModal();
                        DrawerService.toast('Round restarted', { tone: 'danger' });
                      }}
                    >
                      Restart
                    </Button>
                  </div>
                </div>,
                { sticky: true, hideCloseButton: true },
              )
            }
          >
            Sticky custom
          </Button>
        </RefRow>
      </RefBlock>
    </div>
  );
}
