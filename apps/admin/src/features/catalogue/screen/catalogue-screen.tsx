import { Button, Card, DrawerService, Pill } from '@gbedity/ui';
import { Eye, EyeOff, Pencil, Plus, Trash2 } from '@icons';

import { ApiError } from '../../../shared/services/api-client.ts';
import {
  CatalogueStatus,
  useActivateCatalogue,
  useCatalogue,
  useCreateCatalogue,
  useDeactivateCatalogue,
  useDeleteCatalogue,
  useUpdateCatalogue,
  type CatalogueRow,
  type CatalogueStatus as Status,
  type CatalogueUpsert,
} from '../api/catalogue-api.ts';
import { CatalogueForm } from '../parts/catalogue-form.tsx';

// Catalogue curation (api-docs §Admin catalogue). One row per eligible game: author the
// presentation, then activate to publish it to the public landing showcase.

const STATUS_TONE: Record<Status, 'action' | 'warn' | 'default'> = {
  [CatalogueStatus.ACTIVE]: 'action',
  [CatalogueStatus.DRAFT]: 'warn',
  [CatalogueStatus.INACTIVE]: 'default',
};
const STATUS_LABEL: Record<Status, string> = {
  [CatalogueStatus.ACTIVE]: 'Active',
  [CatalogueStatus.DRAFT]: 'Draft',
  [CatalogueStatus.INACTIVE]: 'Inactive',
};

function playersLabel(row: CatalogueRow): string {
  const p = row.manifestPlayers;
  if (p === null) return '—';
  const min = row.entry?.playersMinOverride ?? p.min;
  const max = row.entry?.playersMaxOverride ?? p.max;
  return max === null ? `${min}+` : `${min}–${max}`;
}

function toastError(e: unknown, fallback: string) {
  DrawerService.toast(e instanceof ApiError ? e.message : fallback, { tone: 'danger' });
}

export function CatalogueScreen() {
  const list = useCatalogue();
  const create = useCreateCatalogue();
  const update = useUpdateCatalogue();
  const activate = useActivateCatalogue();
  const deactivate = useDeactivateCatalogue();
  const remove = useDeleteCatalogue();

  function openCreate(row: CatalogueRow) {
    DrawerService.openModal(
      <CatalogueForm row={row} mode="create" onSubmit={(values: CatalogueUpsert) => create.mutateAsync({ gameId: row.gameId, ...values })} />,
      { position: 'bottom' },
    );
  }

  function openEdit(row: CatalogueRow) {
    DrawerService.openModal(
      <CatalogueForm row={row} mode="edit" onSubmit={(patch: CatalogueUpsert) => update.mutateAsync({ gameId: row.gameId, patch })} />,
      { position: 'bottom' },
    );
  }

  function togglePublish(row: CatalogueRow) {
    const isActive = row.status === CatalogueStatus.ACTIVE;
    const mutation = isActive ? deactivate : activate;
    mutation.mutate(row.gameId, {
      onSuccess: () => DrawerService.toast(isActive ? 'Unpublished.' : 'Published.', { tone: 'success' }),
      onError: (e) => toastError(e, 'Could not change status.'),
    });
  }

  function confirmDelete(row: CatalogueRow) {
    DrawerService.confirm(`Remove “${row.title ?? row.gameId}” from the catalogue?`, {
      confirmLabel: 'Remove',
      destructive: true,
      onConfirm: () =>
        remove.mutate(row.gameId, {
          onSuccess: () => DrawerService.toast('Removed.', { tone: 'success' }),
          onError: (e) => toastError(e, 'Could not remove.'),
        }),
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-[32px] font-semibold tracking-[-0.01em] text-ink">Catalogue</h1>
        <p className="font-sans text-[14px] text-ink-3">Author each game’s landing presentation, then publish it to players.</p>
      </div>

      {list.isLoading ? (
        <p className="font-sans text-[14px] text-ink-3">Loading…</p>
      ) : list.isError ? (
        <p className="font-sans text-[14px] text-danger-deep">Couldn’t load the catalogue.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {(list.data ?? []).map((row) => {
            const isActive = row.status === CatalogueStatus.ACTIVE;
            return (
              <Card key={row.gameId} size="sm" className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-sans text-[15px] font-bold text-ink">{row.title ?? row.gameId}</span>
                    {row.status !== null ? <Pill tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Pill> : <Pill tone="default">No entry</Pill>}
                  </div>
                  <span className="font-sans text-[12px] text-ink-3">
                    {row.category ?? '—'} · {row.mode ?? '—'} · {playersLabel(row)} players
                    {row.entry !== null ? ` · ${row.entry.estMinutes}m` : ''}
                  </span>
                </div>

                {row.hasEntry ? (
                  <div className="flex items-center gap-1">
                    <Button variant={isActive ? 'ghost' : 'secondary'} size="sm" leadingIcon={isActive ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />} onClick={() => togglePublish(row)}>
                      {isActive ? 'Unpublish' : 'Publish'}
                    </Button>
                    <button type="button" aria-label="Edit" onClick={() => openEdit(row)} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-3 hover:bg-canvas hover:text-ink">
                      <Pencil size={16} aria-hidden="true" />
                    </button>
                    <button type="button" aria-label="Remove" onClick={() => confirmDelete(row)} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-3 hover:bg-canvas hover:text-danger">
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <Button variant="primary" size="sm" leadingIcon={<Plus size={15} aria-hidden="true" />} onClick={() => openCreate(row)}>
                    Add
                  </Button>
                )}
              </Card>
            );
          })}
          {(list.data?.length ?? 0) === 0 ? <p className="font-sans text-[14px] text-ink-3">No eligible games yet.</p> : null}
        </div>
      )}
    </div>
  );
}
