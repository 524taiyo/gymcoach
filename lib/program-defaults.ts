import { db } from '@/lib/db';

// The active program's current prescription per exercise name.
//
// Used to pre-fill the adjustments panel: the coach is asked to always send the
// five structured fields, but when it omits one we fall back to what the
// program says today rather than showing an empty box. Shared by the weekly
// debrief page and the chat, which both render that panel.
export interface ProgramExerciseDefaults {
  targetRepsMin: number;
  targetRepsMax: number;
  targetSets: number;
  targetRIR: number;
  restSec: number;
}

// Empty when the user has no active program - the apply route would reject the
// write anyway, and the panel simply shows the coach's own numbers.
export async function getProgramDefaults(
  userId: string,
): Promise<Record<string, ProgramExerciseDefaults>> {
  const activeProgram = await db.program.findFirst({
    where: { userId, isActive: true },
    select: {
      workouts: {
        select: {
          exercises: {
            select: {
              targetRepsMin: true,
              targetRepsMax: true,
              targetSets: true,
              targetRIR: true,
              restSec: true,
              exercise: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  const defaults: Record<string, ProgramExerciseDefaults> = {};
  for (const w of activeProgram?.workouts ?? []) {
    for (const pe of w.exercises) {
      const key = pe.exercise.name;
      // First occurrence wins: an exercise repeated across workouts keeps the
      // prescription the user sees first in the program.
      if (defaults[key]) continue;
      defaults[key] = {
        targetRepsMin: pe.targetRepsMin,
        targetRepsMax: pe.targetRepsMax,
        targetSets: pe.targetSets,
        targetRIR: pe.targetRIR,
        restSec: pe.restSec,
      };
    }
  }
  return defaults;
}
