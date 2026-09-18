import { describe, it, expect } from 'vitest';
import { db } from '@/lib/db';
import { applyAdjustmentsToActiveProgram } from '@/lib/coach-apply';
import type { Adjustment } from '@/lib/coach-adjustments';

// The write shared by the weekly debrief and the chat apply routes. What
// matters here is the blast radius: it may only retune exercises that are
// already in the caller's ACTIVE program, and it must leave everything else
// alone - including another user's identically named exercise.

async function makeUser(email: string) {
  return db.user.create({ data: { email, passwordHash: 'x' } });
}

async function seedProgram(userId: string, { active = true } = {}) {
  const bench = await db.exercise.create({
    data: { userId, name: 'Bench', muscleGroup: 'CHEST', category: 'COMPOUND' },
  });
  const program = await db.program.create({
    data: { userId, name: 'P', phase: 'Base', isActive: active },
  });
  const workout = await db.workout.create({
    data: { programId: program.id, name: 'Push', order: 1 },
  });
  const pe = await db.programExercise.create({
    data: {
      workoutId: workout.id,
      exerciseId: bench.id,
      order: 1,
      targetSets: 3,
      targetRepsMin: 6,
      targetRepsMax: 8,
      targetRIR: 2,
      restSec: 150,
    },
  });
  return { program, workout, bench, pe };
}

const benchAdjustment: Adjustment = {
  exerciseName: 'Bench',
  summary: 'Widen the rep range to 6-10',
  rationale: 'Top set progressed twice at RIR 2.',
  suggestedRepsMin: 6,
  suggestedRepsMax: 10,
  suggestedSets: 4,
  suggestedRIR: 2,
  suggestedRestSec: 120,
  currentLoad: 80,
  suggestedLoad: 82.5,
  note: 'Add load at 10 reps',
};

describe('applyAdjustmentsToActiveProgram', () => {
  it('updates the prescription and prepends a dated note', async () => {
    const user = await makeUser('apply-basic@test.dev');
    const { pe } = await seedProgram(user.id);

    const result = await applyAdjustmentsToActiveProgram(
      user.id,
      [benchAdjustment],
      new Date('2026-09-19T10:00:00Z'),
    );
    expect(result.applied).toEqual([{ exerciseName: 'Bench', programExerciseIds: [pe.id] }]);
    expect(result.skipped).toEqual([]);

    const after = await db.programExercise.findUniqueOrThrow({ where: { id: pe.id } });
    expect(after.targetRepsMin).toBe(6);
    expect(after.targetRepsMax).toBe(10);
    expect(after.targetSets).toBe(4);
    expect(after.targetRIR).toBe(2);
    expect(after.restSec).toBe(120);
    expect(after.notes).toBe('[Coach 2026-09-19] Add load at 10 reps · Target: 82.5 kg');
  });

  it('keeps the existing notes history under the new line', async () => {
    const user = await makeUser('apply-notes@test.dev');
    const { pe } = await seedProgram(user.id);
    await db.programExercise.update({ where: { id: pe.id }, data: { notes: 'older note' } });

    await applyAdjustmentsToActiveProgram(
      user.id,
      [{ ...benchAdjustment, note: 'newer note', suggestedLoad: null }],
      new Date('2026-09-19T10:00:00Z'),
    );

    const after = await db.programExercise.findUniqueOrThrow({ where: { id: pe.id } });
    expect(after.notes).toBe('[Coach 2026-09-19] newer note\nolder note');
  });

  it('skips an exercise that is not in the active program instead of creating one', async () => {
    const user = await makeUser('apply-unknown@test.dev');
    await seedProgram(user.id);

    const result = await applyAdjustmentsToActiveProgram(user.id, [
      { ...benchAdjustment, exerciseName: 'Exercise the coach invented' },
    ]);
    expect(result.applied).toEqual([]);
    expect(result.skipped).toEqual([
      {
        exerciseName: 'Exercise the coach invented',
        reason: 'Exercise not found in the active program.',
      },
    ]);
    // No exercise and no program exercise was conjured up.
    expect(
      await db.exercise.count({
        where: { userId: user.id, name: 'Exercise the coach invented' },
      }),
    ).toBe(0);
  });

  it("never touches another user's identically named exercise", async () => {
    const owner = await makeUser('apply-owner@test.dev');
    const stranger = await makeUser('apply-stranger@test.dev');
    await seedProgram(owner.id);
    const strangers = await seedProgram(stranger.id);

    await applyAdjustmentsToActiveProgram(owner.id, [benchAdjustment]);

    const untouched = await db.programExercise.findUniqueOrThrow({
      where: { id: strangers.pe.id },
    });
    expect(untouched.targetRepsMax).toBe(8);
    expect(untouched.targetSets).toBe(3);
    expect(untouched.notes).toBeNull();
  });

  it('leaves an inactive program alone and reports there is nothing to apply to', async () => {
    const user = await makeUser('apply-inactive@test.dev');
    const { pe } = await seedProgram(user.id, { active: false });

    await expect(
      applyAdjustmentsToActiveProgram(user.id, [benchAdjustment]),
    ).rejects.toThrow(/no active program/i);

    const after = await db.programExercise.findUniqueOrThrow({ where: { id: pe.id } });
    expect(after.targetRepsMax).toBe(8);
  });

  it('swaps a reversed rep range rather than writing min > max', async () => {
    const user = await makeUser('apply-reversed@test.dev');
    const { pe } = await seedProgram(user.id);

    await applyAdjustmentsToActiveProgram(user.id, [
      { ...benchAdjustment, suggestedRepsMin: 12, suggestedRepsMax: 8 },
    ]);

    const after = await db.programExercise.findUniqueOrThrow({ where: { id: pe.id } });
    expect(after.targetRepsMin).toBe(8);
    expect(after.targetRepsMax).toBe(12);
  });
});
