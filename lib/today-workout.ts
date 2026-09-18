// Which workout the home screen offers today, and how long it should take.
//
// The home screen leads with one workout rather than a list, so the choice has
// to be deterministic and explainable: the day's workout if the program pins
// one to today, otherwise the next one in the rotation after whatever was
// trained last. Both functions are pure so they can be tested without a DB.

export interface WorkoutCandidate {
  id: string;
  order: number;
  // Prisma stores 1 (Monday) .. 7 (Sunday); null when the workout floats.
  dayOfWeek: number | null;
  exerciseCount: number;
}

export interface PickTodayWorkoutOptions {
  // ISO weekday, 1 (Monday) .. 7 (Sunday).
  isoWeekday: number;
  // Workout of the most recent finished session, when it is still part of the
  // active program. Null on a fresh account or after a program switch.
  lastWorkoutId: string | null;
}

// Returns the workout to lead with, or null when the program has nothing
// trainable (every workout is still empty). Workouts with no exercises are
// never offered: "Start" on them would open an empty session.
export function pickTodayWorkout<T extends WorkoutCandidate>(
  workouts: readonly T[],
  { isoWeekday, lastWorkoutId }: PickTodayWorkoutOptions,
): T | null {
  const candidates = [...workouts]
    .filter((w) => w.exerciseCount > 0)
    .sort((a, b) => a.order - b.order);
  if (candidates.length === 0) return null;

  // 1. The program pins a workout to today.
  const pinned = candidates.find((w) => w.dayOfWeek === isoWeekday);
  if (pinned) return pinned;

  // 2. Continue the rotation from the last thing trained. An unknown id (the
  //    workout was deleted, or it belonged to another program) falls through.
  if (lastWorkoutId) {
    const lastIndex = candidates.findIndex((w) => w.id === lastWorkoutId);
    if (lastIndex !== -1) {
      return candidates[(lastIndex + 1) % candidates.length] ?? null;
    }
  }

  // 3. Start of the rotation.
  return candidates[0] ?? null;
}

export interface WorkoutExerciseTargets {
  targetSets: number;
  targetRepsMin: number;
  targetRepsMax: number;
  restSec: number;
}

// Rough setup cost of a session: getting changed, warming up, walking to the
// first rack. Kept out of the per-set math so the estimate never reads as 0.
const SETUP_MINUTES = 5;
// A rep under load plus the re-rack, averaged. Deliberately coarse: this feeds
// an "about N minutes" label, not a countdown.
const SECONDS_PER_REP = 3.5;

// "About M minutes" for a planned workout, rounded to the nearest 5 so the
// number never pretends to a precision it does not have.
export function estimateWorkoutMinutes(exercises: readonly WorkoutExerciseTargets[]): number {
  const seconds = exercises.reduce((total, e) => {
    const avgReps = (e.targetRepsMin + e.targetRepsMax) / 2;
    return total + e.targetSets * (avgReps * SECONDS_PER_REP + e.restSec);
  }, 0);
  const minutes = SETUP_MINUTES + seconds / 60;
  return Math.max(SETUP_MINUTES, Math.round(minutes / 5) * 5);
}
