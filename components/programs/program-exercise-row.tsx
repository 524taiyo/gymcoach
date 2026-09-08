'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link2, MoreHorizontal, Pencil, Trash2, Unlink } from 'lucide-react';
import type { Exercise, ProgramExercise } from '@/lib/prisma-client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ProgramExerciseFormDialog } from '@/components/programs/program-exercise-form-dialog';
import { muscleGroupMessageKeys } from '@/i18n/enum-keys';
import { useExerciseName } from '@/components/shared/use-exercise-name';

type ProgramExerciseWithExercise = ProgramExercise & { exercise: Exercise };

interface Props {
  programExercise: ProgramExerciseWithExercise;
  catalog: Exercise[];
  // Superset pairing (issue #146, slice 1). The label ("A1") is derived by the
  // parent from group membership and order; the actions are null when not
  // applicable (first row cannot pair up, a standalone row cannot unpair).
  supersetLabel?: string | null;
  onPairWithPrevious?: (() => void) | null;
  onUnpair?: (() => void) | null;
}

// One programmed exercise: name, the prescription in one line, and a menu.
// Tapping the row opens the editor; the category / auto-regulation badges of
// the previous design are gone (they live in the editor's advanced section).
export function ProgramExerciseRow({
  programExercise,
  catalog,
  supersetLabel = null,
  onPairWithPrevious = null,
  onUnpair = null,
}: Props) {
  const t = useTranslations('programs.exercise');
  const exerciseT = useTranslations('exercises');
  const common = useTranslations('common');
  const exerciseName = useExerciseName();
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(t('removeConfirm', { name: exerciseName(programExercise.exercise.name) }))) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/program-exercises/${programExercise.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        toast.error(t('removeError'));
        return;
      }
      toast.success(t('removed'));
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  const repsLabel =
    programExercise.targetRepsMin === programExercise.targetRepsMax
      ? `${programExercise.targetRepsMin}`
      : `${programExercise.targetRepsMin}-${programExercise.targetRepsMax}`;

  return (
    <>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card/50 pl-3 pr-1">
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="min-w-0 flex-1 py-2.5 text-left"
          aria-label={t('edit')}
        >
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {supersetLabel && <Badge>{supersetLabel}</Badge>}
            <p className="truncate text-sm font-medium">
              {exerciseName(programExercise.exercise.name)}
            </p>
            <span className="text-xs text-muted-foreground">
              {exerciseT(
                `muscleGroups.${muscleGroupMessageKeys[programExercise.exercise.muscleGroup]}`,
              )}
            </span>
          </div>
          <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
            {t('prescription', {
              sets: programExercise.targetSets,
              reps: repsLabel,
              rir: programExercise.targetRIR,
              seconds: programExercise.restSec,
            })}
            {programExercise.tempo && t('tempoValue', { tempo: programExercise.tempo })}
          </p>
          {programExercise.notes && (
            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground/80">
              {programExercise.notes}
            </p>
          )}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-11 shrink-0 text-muted-foreground"
              aria-label={t('actions')}
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setEditOpen(true)}>
              <Pencil className="mr-2 size-4" />
              {common('actions.edit')}
            </DropdownMenuItem>
            {onPairWithPrevious && (
              <DropdownMenuItem onSelect={() => onPairWithPrevious()}>
                <Link2 className="mr-2 size-4" />
                {t('pairPrevious')}
              </DropdownMenuItem>
            )}
            {onUnpair && (
              <DropdownMenuItem onSelect={() => onUnpair()}>
                <Unlink className="mr-2 size-4" />
                {t('unpair')}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={handleDelete}
              disabled={deleting}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 size-4" />
              {common('actions.remove')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ProgramExerciseFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        programExercise={programExercise}
        catalog={catalog}
      />
    </>
  );
}
