'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChevronLeft, Pencil } from 'lucide-react';
import { PlusIcon } from '@/components/icons';
import type { Exercise, Program, ProgramExercise, Workout } from '@/lib/prisma-client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ProgramEditDialog } from '@/components/programs/program-edit-dialog';
import { ProgramDeleteButton } from '@/components/programs/program-delete-button';
import { WorkoutCard } from '@/components/programs/workout-card';
import { WorkoutFormDialog } from '@/components/programs/workout-form-dialog';
import { useTrainingName } from '@/components/shared/use-training-name';

type ProgramExerciseWithExercise = ProgramExercise & { exercise: Exercise };
type WorkoutWithExercises = Workout & { exercises: ProgramExerciseWithExercise[] };
export type ProgramFull = Program & { workouts: WorkoutWithExercises[] };

interface Props {
  program: ProgramFull;
  catalog: Exercise[];
  // True right after "build it yourself" created the program: opens the
  // add-session dialog so the next step is already on screen.
  openAddSession?: boolean;
}

export function ProgramDetailView({ program, catalog, openAddSession = false }: Props) {
  const t = useTranslations('programs');
  const common = useTranslations('common');
  const trainingName = useTrainingName();
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [addWorkoutOpen, setAddWorkoutOpen] = useState(openAddSession);
  const [activating, setActivating] = useState(false);

  async function setActive(active: boolean) {
    if (active === program.isActive) return;
    setActivating(true);
    try {
      const res = await fetch(`/api/programs/${program.id}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active }),
      });
      if (!res.ok) {
        toast.error(t('saveError'));
        return;
      }
      toast.success(active ? t('activated') : t('deactivated'));
      router.refresh();
    } finally {
      setActivating(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <Button asChild variant="ghost" size="sm" className="-ml-2 self-start">
        <Link href="/programs">
          <ChevronLeft className="size-4" />
          <span className="ml-1">{common('actions.back')}</span>
        </Link>
      </Button>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-xl">{trainingName(program.name)}</CardTitle>
              <CardDescription className="mt-1 flex flex-wrap items-center gap-2">
                <span>{program.phase}</span>
                {program.isActive && <Badge>{t('active')}</Badge>}
              </CardDescription>
              {program.description && (
                <p className="mt-2 text-sm text-muted-foreground">{program.description}</p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 text-muted-foreground"
              onClick={() => setEditOpen(true)}
              aria-label={common('actions.edit')}
            >
              <Pencil className="size-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-0">
          <div className="flex items-center gap-3">
            <Switch
              id="program-active"
              checked={program.isActive}
              onCheckedChange={setActive}
              disabled={activating}
            />
            <div>
              <Label htmlFor="program-active" className="text-sm font-medium">
                {t('useProgram')}
              </Label>
              <p className="text-xs text-muted-foreground">{t('useProgramHelp')}</p>
            </div>
          </div>
          <ProgramDeleteButton programId={program.id} programName={trainingName(program.name)} />
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t('sessions')}</h2>
        <Button size="sm" onClick={() => setAddWorkoutOpen(true)} className="h-10">
          <PlusIcon className="size-4" />
          <span className="ml-1">{t('addSession')}</span>
        </Button>
      </div>

      {program.workouts.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('noSessions')}</CardTitle>
            <CardDescription>{t('noSessionsDescription')}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {program.workouts.map((w) => (
            <WorkoutCard key={w.id} workout={w} catalog={catalog} />
          ))}
        </div>
      )}

      <ProgramEditDialog open={editOpen} onOpenChange={setEditOpen} program={program} />
      <WorkoutFormDialog
        open={addWorkoutOpen}
        onOpenChange={setAddWorkoutOpen}
        mode="create"
        programId={program.id}
      />
    </div>
  );
}
