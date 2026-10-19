'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { Loader2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useExerciseName } from '@/components/shared/use-exercise-name';
import { useTrainingName } from '@/components/shared/use-training-name';
import type { ChangeBatchView } from '@/lib/program-changes';

interface Props {
  batches: ChangeBatchView[];
}

// Recent coach changes the user approved on this program (ProgramChangeLog),
// with undo for the newest batch that is still applied.
export function ProgramChangesCard({ batches }: Props) {
  const t = useTranslations('programs.changes');
  const actionT = useTranslations('coach.adjustments.actions');
  const format = useFormatter();
  const exerciseName = useExerciseName();
  const trainingName = useTrainingName();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (batches.length === 0) return null;

  async function undo(batchId: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/program-changes/${encodeURIComponent(batchId)}/undo`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(data?.error ?? t('undoError'));
        return;
      }
      toast.success(t('undone'));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-3 text-sm">
          {batches.map((batch) => (
            <li key={batch.batchId} className="flex flex-col gap-1.5 rounded-md border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {format.dateTime(new Date(batch.appliedAt), {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {' · '}
                  {t(batch.source === 'chat' ? 'sourceChat' : 'sourceDebrief')}
                </span>
                {batch.undone && <Badge variant="secondary">{t('undoneBadge')}</Badge>}
                {batch.undoable && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="ml-auto"
                    onClick={() => undo(batch.batchId)}
                    disabled={busy}
                  >
                    {busy ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Undo2 className="size-4" />
                    )}
                    <span className="ml-1">{t('undo')}</span>
                  </Button>
                )}
              </div>
              <ul className="flex flex-col gap-0.5">
                {batch.items.map((item) => (
                  <li key={`${item.action}:${item.exerciseName}`} className="flex gap-2">
                    <Badge variant="outline">{actionT(item.action as 'update')}</Badge>
                    <span className={batch.undone ? 'text-muted-foreground line-through' : ''}>
                      {exerciseName(item.exerciseName)}
                      {item.workoutName && item.action !== 'update' && (
                        <span className="text-muted-foreground">
                          {' '}
                          ({trainingName(item.workoutName)})
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
