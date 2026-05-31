import { useEffect, useState } from 'react';

import { Button, Card, DrawerService, Slider } from '@gbedity/ui';

import { useRubric, useSaveRubric, type Rubric } from '../../shared/api/admin-api.ts';
import { ApiError } from '../../shared/services/api-client.ts';

// Plead Your Case rubric editor (api-docs §rubric). Weight sliders per criterion; save PUTs
// the full criteria array.
export function RubricScreen() {
  const rubric = useRubric();
  const save = useSaveRubric();
  const [criteria, setCriteria] = useState<Rubric['criteria']>([]);

  useEffect(() => {
    if (rubric.data !== undefined) setCriteria(rubric.data.criteria);
  }, [rubric.data]);

  function setWeight(key: string, weight: number) {
    setCriteria((cs) => cs.map((c) => (c.key === key ? { ...c, weight } : c)));
  }

  function handleSave() {
    save.mutate(criteria, {
      onSuccess: () => DrawerService.toast('Rubric saved.', { tone: 'success' }),
      onError: (e) => DrawerService.toast(e instanceof ApiError ? e.message : 'Could not save.', { tone: 'danger' }),
    });
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="font-serif text-[32px] font-semibold tracking-[-0.01em] text-ink">AI rubric</h1>
      <p className="font-sans text-[14px] text-ink-3">Tune how the Plead Your Case AI weights each criterion.</p>

      {rubric.isLoading ? (
        <p className="font-sans text-[14px] text-ink-3">Loading…</p>
      ) : rubric.isError ? (
        <p className="font-sans text-[14px] text-danger-deep">Couldn’t load the rubric.</p>
      ) : (
        <Card size="lg" className="flex flex-col gap-5">
          {criteria.map((c) => (
            <div key={c.key}>
              <div className="mb-1 flex items-center justify-between">
                <span className="font-sans text-[14px] font-bold text-ink">{c.label}</span>
                <span className="font-serif text-[16px] font-semibold tabular-nums text-ink-2">{c.weight}</span>
              </div>
              <Slider value={c.weight} onChange={(w) => setWeight(c.key, w)} ariaLabel={`${c.label} weight`} />
            </div>
          ))}
          <Button variant="primary" loading={save.isPending} onClick={handleSave}>Save rubric</Button>
        </Card>
      )}
    </div>
  );
}
