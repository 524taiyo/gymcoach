import type { MuscleGroup } from '@/lib/prisma-client';

// Coarse body-part buckets for the exercise picker's tabs. The catalog keeps
// its fine-grained muscle groups (front / lateral / rear delts, back width vs
// thickness); the picker folds them into the five regions lifters think in
// (chest, back, shoulders, arms, legs) plus core and a catch-all.
export type BodyPart = 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'core' | 'other';

export const BODY_PARTS: readonly BodyPart[] = [
  'chest',
  'back',
  'shoulders',
  'arms',
  'legs',
  'core',
  'other',
];

const BODY_PART_BY_MUSCLE: Record<MuscleGroup, BodyPart> = {
  CHEST: 'chest',
  BACK_WIDTH: 'back',
  BACK_THICKNESS: 'back',
  LOWER_BACK: 'back',
  SHOULDERS_FRONT: 'shoulders',
  SHOULDERS_LATERAL: 'shoulders',
  SHOULDERS_REAR: 'shoulders',
  BICEPS: 'arms',
  TRICEPS: 'arms',
  FOREARMS: 'arms',
  QUADS: 'legs',
  HAMSTRINGS: 'legs',
  GLUTES: 'legs',
  CALVES: 'legs',
  ABS: 'core',
  OTHER: 'other',
};

export function bodyPartOf(muscleGroup: MuscleGroup): BodyPart {
  return BODY_PART_BY_MUSCLE[muscleGroup];
}
