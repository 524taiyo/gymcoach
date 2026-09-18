import { db } from '@/lib/db';
import { ApiError } from '@/lib/api';
import type { Adjustment } from '@/lib/coach-adjustments';

// Applying coach-proposed adjustments to the active program.
//
// Extracted from POST /api/coach/[id]/apply so the weekly debrief and the chat
// share ONE write path: the same ownership scoping, the same "only retune what
// is already in the program" rule, the same dated note trail. A second copy of
// this logic would be a second place for those guarantees to drift.

export interface AppliedAdjustment {
  exerciseName: string;
  programExerciseIds: string[];
}

export interface SkippedAdjustment {
  exerciseName: string;
  reason: string;
}

export interface ApplyResult {
  applied: AppliedAdjustment[];
  skipped: SkippedAdjustment[];
}

// Updates the matching ProgramExercise records of the user's ACTIVE program by
// exercise name, and prepends a dated line to their notes. Adjustments naming
// an exercise that is not in the active program are skipped, never created:
// the coach may retune the prescription, not restructure the program.
//
// Throws ApiError(400) when there is no active program to write to.
export async function applyAdjustmentsToActiveProgram(
  userId: string,
  adjustments: Adjustment[],
  now: Date = new Date(),
): Promise<ApplyResult> {
  const activeProgram = await db.program.findFirst({
    where: { userId, isActive: true },
    include: {
      workouts: {
        include: {
          exercises: {
            include: { exercise: { select: { id: true, name: true } } },
          },
        },
      },
    },
  });
  if (!activeProgram) {
    throw new ApiError(400, 'No active program to apply the adjustments to.');
  }

  // Index of ProgramExercise by exercise name (in case of duplicates, we
  // collect every occurrence to apply everywhere in the program).
  const byExerciseName = new Map<string, (typeof activeProgram.workouts)[number]['exercises']>();
  for (const w of activeProgram.workouts) {
    for (const pe of w.exercises) {
      const key = pe.exercise.name;
      const arr = byExerciseName.get(key);
      if (arr) arr.push(pe);
      else byExerciseName.set(key, [pe]);
    }
  }

  const today = now.toISOString().slice(0, 10);
  const applied: AppliedAdjustment[] = [];
  const skipped: SkippedAdjustment[] = [];

  for (const adj of adjustments) {
    const matches = byExerciseName.get(adj.exerciseName);
    if (!matches || matches.length === 0) {
      skipped.push({
        exerciseName: adj.exerciseName,
        reason: 'Exercise not found in the active program.',
      });
      continue;
    }

    // Build the update object from the fields that are present.
    const data: {
      targetRepsMin?: number;
      targetRepsMax?: number;
      targetSets?: number;
      targetRIR?: number;
      restSec?: number;
      notes?: string;
    } = {};
    if (adj.suggestedRepsMin != null) data.targetRepsMin = adj.suggestedRepsMin;
    if (adj.suggestedRepsMax != null) data.targetRepsMax = adj.suggestedRepsMax;
    if (adj.suggestedSets != null) data.targetSets = adj.suggestedSets;
    if (adj.suggestedRIR != null) data.targetRIR = adj.suggestedRIR;
    if (adj.suggestedRestSec != null) data.restSec = adj.suggestedRestSec;

    // Safeguard: if min > max after the update, we swap them silently (the AI
    // can be wrong, we avoid a silent business-rule violation).
    if (
      data.targetRepsMin != null &&
      data.targetRepsMax != null &&
      data.targetRepsMin > data.targetRepsMax
    ) {
      const tmp = data.targetRepsMin;
      data.targetRepsMin = data.targetRepsMax;
      data.targetRepsMax = tmp;
    }

    const ids: string[] = [];
    for (const pe of matches) {
      // Build the notes block: we add a dated line on top of the existing
      // notes, rather than overwriting the history.
      const noteLine = buildNoteLine(today, adj.note, adj.summary, adj.suggestedLoad);
      const nextNotes = noteLine
        ? pe.notes
          ? `${noteLine}\n${pe.notes}`
          : noteLine
        : undefined;

      await db.programExercise.update({
        where: { id: pe.id },
        data: {
          ...data,
          ...(nextNotes !== undefined ? { notes: nextNotes } : {}),
        },
      });
      ids.push(pe.id);
    }
    applied.push({ exerciseName: adj.exerciseName, programExerciseIds: ids });
  }

  return { applied, skipped };
}

function buildNoteLine(
  today: string,
  note: string | null | undefined,
  summary: string,
  suggestedLoad: number | null | undefined,
): string | null {
  const parts: string[] = [];
  if (note?.trim()) parts.push(note.trim());
  else parts.push(summary.trim());
  if (suggestedLoad != null) parts.push(`Target: ${suggestedLoad} kg`);
  if (parts.length === 0) return null;
  return `[Coach ${today}] ${parts.join(' · ')}`;
}
