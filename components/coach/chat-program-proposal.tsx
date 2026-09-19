'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Check, Loader2, Wand2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useExerciseName } from '@/components/shared/use-exercise-name';
import { countProgramExercises } from '@/lib/coach-program';
import type { GeneratedProgram } from '@/lib/schemas/program-generation';

const DAY_KEYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

// A whole program proposed in the chat, previewed before it exists.
//
// Creating it goes through the SAME two endpoints the /programs/generate page
// uses - POST /api/programs/build (Zod-validated, creates the program
// inactive and adds any missing exercises to the catalog) then
// POST /api/programs/[id]/activate - so the chat is not a second, looser way
// into program creation. The preview is read-only on purpose: the program
// editor is one tap away once it exists, and it is the better place to tweak.
export function ChatProgramProposal({
  program,
  createdId,
  onCreated,
}: {
  program: GeneratedProgram;
  // Set once this proposal has been created in this view.
  createdId: string | null;
  onCreated: (id: string) => void;
}) {
  const t = useTranslations('coach.programProposal');
  const common = useTranslations('common');
  const exerciseName = useExerciseName();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch('/api/programs/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(program),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Error ${res.status}`);
      }
      const { id } = (await res.json()) as { id: string };

      // Built inactive; the point of asking the coach for a plan is to run it.
      const activated = await fetch(`/api/programs/${id}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: true }),
      });
      if (!activated.ok) {
        const j = (await activated.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Error ${activated.status}`);
      }

      onCreated(id);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('error'));
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Wand2 className="size-5" />
            <h2 className="text-base font-semibold">{t('title')}</h2>
          </div>
          {createdId && <Badge variant="secondary">{t('created')}</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">{t('description')}</p>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <div>
          <p className="font-medium">{program.name}</p>
          <p className="text-xs text-muted-foreground">
            {program.phase}
            {' · '}
            {t('summary', {
              workouts: program.workouts.length,
              exercises: countProgramExercises(program),
            })}
          </p>
          {program.description && (
            <p className="mt-1 text-sm text-muted-foreground">{program.description}</p>
          )}
        </div>

        <ul className="flex flex-col gap-2">
          {program.workouts.map((w, i) => {
            const dayKey = w.dayOfWeek != null ? DAY_KEYS[w.dayOfWeek - 1] : null;
            return (
              <li key={i} className="rounded-md border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-medium">{w.name}</p>
                  {dayKey && (
                    <Badge variant="secondary" className="shrink-0">
                      {common(`days.${dayKey}`)}
                    </Badge>
                  )}
                </div>
                <ul className="mt-2 flex flex-col gap-1">
                  {w.exercises.map((e, j) => (
                    <li
                      key={j}
                      className="flex items-baseline justify-between gap-3 text-xs text-muted-foreground"
                    >
                      <span className="min-w-0 truncate text-foreground">
                        {exerciseName(e.name)}
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {e.targetSets}x{e.targetRepsMin}-{e.targetRepsMax} / RIR {e.targetRIR} /{' '}
                        {e.restSec}s
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>

        {error && <p className="text-sm text-rose-600">{error}</p>}

        {createdId ? (
          <Button asChild variant="outline" className="min-h-12 w-full text-base">
            <Link href={`/programs/${createdId}`}>{t('open')}</Link>
          </Button>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">{t('willReplace')}</p>
            <Button onClick={create} disabled={pending} className="min-h-12 w-full text-base">
              {pending ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <Check className="size-5" />
              )}
              <span className="ml-2">{pending ? t('creating') : t('create')}</span>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
