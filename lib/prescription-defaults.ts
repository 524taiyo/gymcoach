import type { ExerciseCategory, MuscleGroup } from '@/lib/prisma-client';

// Starting prescription offered when an exercise is added to a workout. These
// are hypertrophy-oriented defaults the lifter is expected to edit, not rules:
// heavy compounds get fewer, harder reps with longer rest; isolation and
// small-muscle work gets more reps at a slightly higher effort.

export interface Prescription {
  targetSets: number;
  targetRepsMin: number;
  targetRepsMax: number;
  targetRIR: number;
}

interface PrescriptionInput {
  category: ExerciseCategory;
  muscleGroup: MuscleGroup;
}

// Muscles that respond better to higher rep ranges regardless of category.
const HIGH_REP_GROUPS: ReadonlySet<MuscleGroup> = new Set([
  'CALVES',
  'ABS',
  'FOREARMS',
  'SHOULDERS_LATERAL',
  'SHOULDERS_REAR',
]);

export function recommendedPrescription({
  category,
  muscleGroup,
}: PrescriptionInput): Prescription {
  if (category === 'CARDIO') {
    return { targetSets: 1, targetRepsMin: 1, targetRepsMax: 1, targetRIR: 0 };
  }
  if (HIGH_REP_GROUPS.has(muscleGroup)) {
    return { targetSets: 3, targetRepsMin: 12, targetRepsMax: 15, targetRIR: 1 };
  }
  if (category === 'COMPOUND') {
    return { targetSets: 4, targetRepsMin: 6, targetRepsMax: 10, targetRIR: 2 };
  }
  return { targetSets: 3, targetRepsMin: 10, targetRepsMax: 15, targetRIR: 1 };
}
