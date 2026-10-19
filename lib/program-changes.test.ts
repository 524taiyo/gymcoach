import { describe, expect, it } from 'vitest';
import { adjustmentSchema, type Adjustment } from './coach-adjustments';
import {
  NOT_FOUND_REASON,
  groupChangeBatches,
  orderedIds,
  ordersOf,
  placeAt,
  planProgramChanges,
  type SnapshotWorkout,
} from './program-changes';

const prescription = {
  targetSets: 3,
  targetRepsMin: 8,
  targetRepsMax: 12,
  targetRIR: 2,
  restSec: 90,
  notes: null,
};

function workout(id: string, name: string, exercises: string[]): SnapshotWorkout {
  return {
    id,
    name,
    exercises: exercises.map((exerciseName, i) => ({
      id: `${id}-${exerciseName}`,
      order: i + 1,
      exerciseId: `ex-${exerciseName}`,
      exerciseName,
      ...prescription,
    })),
  };
}

const push = workout('w1', 'Push', ['Bench', 'Fly', 'Pushdown']);
const upper = workout('w2', 'Upper', ['Bench', 'Row']);
const today = '2026-10-20';
const adj = (a: Partial<Adjustment> & { exerciseName: string }): Adjustment => ({
  summary: 's',
  ...a,
});

describe('planProgramChanges', () => {
  it('keeps the update default: retune every occurrence, never create', () => {
    const { changes, skipped } = planProgramChanges(
      [push, upper],
      [adj({ exerciseName: 'Bench', suggestedSets: 4 }), adj({ exerciseName: 'Dips' })],
      today,
    );
    expect(changes).toHaveLength(1);
    const change = changes[0]!;
    expect(change.action).toBe('update');
    if (change.action === 'update') {
      expect(change.targets.map((t) => t.workout.name)).toEqual(['Push', 'Upper']);
      expect(change.targets[0]!.patch).toMatchObject({ targetSets: 4 });
    }
    expect(skipped).toEqual([{ exerciseName: 'Dips', reason: NOT_FOUND_REASON }]);
  });

  it('narrows an update to one workout when workoutName is given', () => {
    const { changes } = planProgramChanges(
      [push, upper],
      [adj({ exerciseName: 'Bench', workoutName: 'Upper', suggestedSets: 5 })],
      today,
    );
    const change = changes[0]!;
    expect(change.action === 'update' && change.targets.map((t) => t.workout.name)).toEqual([
      'Upper',
    ]);
  });

  it('adds into the named workout, clamping the position, and refuses duplicates', () => {
    const { changes, skipped } = planProgramChanges(
      [push],
      [
        adj({ action: 'add', exerciseName: 'Dips', workoutName: 'Push', position: 9 }),
        adj({ action: 'add', exerciseName: 'Dips', workoutName: 'Push' }),
        adj({ action: 'add', exerciseName: 'Fly', workoutName: 'Push' }),
        adj({ action: 'add', exerciseName: 'Curl', workoutName: 'Pull' }),
      ],
      today,
    );
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ action: 'add', position: 4 });
    expect(skipped.map((s) => s.reason)).toEqual([
      'Exercise is already in this workout.',
      'Exercise is already in this workout.',
      'Workout not found in the active program.',
    ]);
  });

  it('requires an unambiguous row for remove and move', () => {
    const { changes, skipped } = planProgramChanges(
      [push, upper],
      [
        adj({ action: 'remove', exerciseName: 'Bench' }),
        adj({ action: 'remove', exerciseName: 'Bench', workoutName: 'Upper' }),
        adj({ action: 'move', exerciseName: 'Pushdown', workoutName: 'Push', position: 1 }),
      ],
      today,
    );
    expect(skipped).toEqual([
      { exerciseName: 'Bench', reason: 'Exercise appears in several workouts; name the workout.' },
    ]);
    expect(changes.map((c) => c.action)).toEqual(['remove', 'move']);
  });

  it('never empties a workout, even with several removals in one batch', () => {
    const legs = workout('w3', 'Legs', ['Squat', 'Curl']);
    const { changes, skipped } = planProgramChanges(
      [legs],
      [
        adj({ action: 'remove', exerciseName: 'Squat' }),
        adj({ action: 'remove', exerciseName: 'Curl' }),
      ],
      today,
    );
    expect(changes).toHaveLength(1);
    expect(skipped[0]!.reason).toBe('Cannot remove the last exercise of a workout.');
  });

  it('prepends a dated coach note and swaps a reversed rep range', () => {
    const { changes } = planProgramChanges(
      [push],
      [
        adj({
          exerciseName: 'Fly',
          suggestedRepsMin: 15,
          suggestedRepsMax: 10,
          note: 'Slow eccentric',
        }),
      ],
      today,
    );
    const change = changes[0]!;
    const patch = change.action === 'update' ? change.targets[0]!.patch : null;
    expect(patch).toEqual({
      targetRepsMin: 10,
      targetRepsMax: 15,
      notes: '[Coach 2026-10-20] Slow eccentric',
    });
  });
});

describe('ordering helpers', () => {
  it('places an id at a 1-based position and numbers the sequence', () => {
    const ids = orderedIds([
      { id: 'b', order: 2 },
      { id: 'a', order: 1 },
      { id: 'c', order: 3 },
    ]);
    expect(ids).toEqual(['a', 'b', 'c']);
    expect(placeAt(ids, 'c', 1)).toEqual(['c', 'a', 'b']);
    expect(placeAt(ids, 'a', 99)).toEqual(['b', 'c', 'a']);
    expect(ordersOf(['x', 'y'])).toEqual({ x: 1, y: 2 });
  });
});

describe('adjustmentSchema actions', () => {
  it('keeps accepting the original update shape', () => {
    const r = adjustmentSchema.safeParse({ exerciseName: 'Bench', summary: 's', suggestedSets: 4 });
    expect(r.success).toBe(true);
  });

  it('requires a workout and a full prescription to add', () => {
    const missing = adjustmentSchema.safeParse({
      action: 'add',
      exerciseName: 'Dips',
      summary: 's',
    });
    expect(missing.success).toBe(false);
    const full = adjustmentSchema.safeParse({
      action: 'add',
      exerciseName: 'Dips',
      workoutName: 'Push',
      summary: 's',
      suggestedSets: 3,
      suggestedRepsMin: 6,
      suggestedRepsMax: 10,
      suggestedRIR: 2,
      suggestedRestSec: 120,
    });
    expect(full.success).toBe(true);
  });

  it('requires a workout and a position to move', () => {
    const noPosition = adjustmentSchema.safeParse({
      action: 'move',
      exerciseName: 'Fly',
      workoutName: 'Push',
      summary: 's',
    });
    expect(noPosition.success).toBe(false);
    const ok = adjustmentSchema.safeParse({
      action: 'move',
      exerciseName: 'Fly',
      workoutName: 'Push',
      position: 1,
      summary: 's',
    });
    expect(ok.success).toBe(true);
  });

  it('rejects an unknown action', () => {
    const r = adjustmentSchema.safeParse({ action: 'swap', exerciseName: 'Fly', summary: 's' });
    expect(r.success).toBe(false);
  });
});

describe('groupChangeBatches', () => {
  const row = (
    batchId: string,
    minute: number,
    extra: Partial<Parameters<typeof groupChangeBatches>[0][number]> = {},
  ) => ({
    batchId,
    source: 'chat',
    action: 'update',
    exerciseName: 'Bench',
    workoutName: 'Push',
    createdAt: new Date(Date.UTC(2026, 9, 20, 10, minute)),
    undoneAt: null,
    ...extra,
  });

  it('groups by batch, newest first, and only the newest live batch is undoable', () => {
    const batches = groupChangeBatches([
      row('a', 0),
      row('a', 0, { workoutName: 'Upper' }),
      row('b', 5, { action: 'add', exerciseName: 'Dips' }),
      row('c', 9, { undoneAt: new Date() }),
    ]);
    expect(batches.map((b) => [b.batchId, b.undone, b.undoable])).toEqual([
      ['c', true, false],
      ['b', false, true],
      ['a', false, false],
    ]);
    // The same update on two workouts collapses to one item.
    expect(batches[2]!.items).toEqual([
      { action: 'update', exerciseName: 'Bench', workoutName: 'Push' },
    ]);
  });

  it('keeps at most the requested number of batches', () => {
    const rows = Array.from({ length: 7 }, (_, i) => row(`b${i}`, i));
    expect(groupChangeBatches(rows, 5)).toHaveLength(5);
  });
});
