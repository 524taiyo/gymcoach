import { describe, expect, it } from 'vitest';
import {
  estimateWorkoutMinutes,
  pickTodayWorkout,
  type WorkoutCandidate,
} from './today-workout';

// Upper / Lower split, the shape this app is used with: two workouts pinned to
// Monday and Thursday, one floating.
const UPPER: WorkoutCandidate = { id: 'upper', order: 0, dayOfWeek: 1, exerciseCount: 6 };
const LOWER: WorkoutCandidate = { id: 'lower', order: 1, dayOfWeek: 4, exerciseCount: 5 };
const FLOAT: WorkoutCandidate = { id: 'float', order: 2, dayOfWeek: null, exerciseCount: 4 };

describe('pickTodayWorkout', () => {
  it('prefers the workout pinned to today', () => {
    const picked = pickTodayWorkout([UPPER, LOWER, FLOAT], {
      isoWeekday: 4,
      lastWorkoutId: null,
    });
    expect(picked?.id).toBe('lower');
  });

  it('continues the rotation after the last workout trained', () => {
    // Tuesday: nothing is pinned, and Upper was the last session.
    const picked = pickTodayWorkout([UPPER, LOWER, FLOAT], {
      isoWeekday: 2,
      lastWorkoutId: 'upper',
    });
    expect(picked?.id).toBe('lower');
  });

  it('wraps around at the end of the rotation', () => {
    const picked = pickTodayWorkout([UPPER, LOWER, FLOAT], {
      isoWeekday: 2,
      lastWorkoutId: 'float',
    });
    expect(picked?.id).toBe('upper');
  });

  it('starts at the top of the rotation on a fresh account', () => {
    const picked = pickTodayWorkout([LOWER, FLOAT, UPPER], {
      isoWeekday: 2,
      lastWorkoutId: null,
    });
    expect(picked?.id).toBe('upper');
  });

  it('ignores a last workout that is no longer in the program', () => {
    const picked = pickTodayWorkout([UPPER, LOWER, FLOAT], {
      isoWeekday: 2,
      lastWorkoutId: 'deleted-workout',
    });
    expect(picked?.id).toBe('upper');
  });

  it('never offers an empty workout, even when it is pinned to today', () => {
    const emptyMonday: WorkoutCandidate = { ...UPPER, exerciseCount: 0 };
    const picked = pickTodayWorkout([emptyMonday, LOWER], {
      isoWeekday: 1,
      lastWorkoutId: null,
    });
    expect(picked?.id).toBe('lower');
  });

  it('returns null when the program has nothing trainable', () => {
    expect(
      pickTodayWorkout([{ ...UPPER, exerciseCount: 0 }], { isoWeekday: 1, lastWorkoutId: null }),
    ).toBeNull();
    expect(pickTodayWorkout([], { isoWeekday: 1, lastWorkoutId: null })).toBeNull();
  });
});

describe('estimateWorkoutMinutes', () => {
  it('counts working time plus rest plus a fixed setup cost', () => {
    // 3 sets x (10 reps x 3.5 s + 120 s rest) = 465 s = 7.75 min, +5 setup.
    expect(
      estimateWorkoutMinutes([
        { targetSets: 3, targetRepsMin: 8, targetRepsMax: 12, restSec: 120 },
      ]),
    ).toBe(15);
  });

  it('scales with the number of exercises', () => {
    const one = estimateWorkoutMinutes([
      { targetSets: 3, targetRepsMin: 8, targetRepsMax: 12, restSec: 90 },
    ]);
    const six = estimateWorkoutMinutes(
      Array.from({ length: 6 }, () => ({
        targetSets: 3,
        targetRepsMin: 8,
        targetRepsMax: 12,
        restSec: 90,
      })),
    );
    expect(six).toBeGreaterThan(one);
    expect(six % 5).toBe(0);
  });

  it('falls back to the setup cost for an empty workout', () => {
    expect(estimateWorkoutMinutes([])).toBe(5);
  });
});
