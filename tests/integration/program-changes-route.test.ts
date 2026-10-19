import { describe, it, expect, vi } from 'vitest';
import { db } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';

// Auth is read through getCurrentUserId (via requireApiUserId in @/lib/api).
vi.mock('@/lib/auth', () => ({ getCurrentUserId: vi.fn() }));
const mockUserId = vi.mocked(getCurrentUserId);

import { applyAdjustmentsToActiveProgram } from '@/lib/coach-apply';
import { POST as undoBatch } from '@/app/api/program-changes/[batchId]/undo/route';
import type { Adjustment } from '@/lib/coach-adjustments';

// Structural coach changes (add / remove / move) and their undo, plus the
// cross-user guarantee of the undo route: a batch id is only ever resolved
// inside the caller's own change log.

function actAs(userId: string) {
  mockUserId.mockResolvedValue(userId);
}

function undo(batchId: string) {
  return undoBatch(new Request('http://test/undo', { method: 'POST' }), {
    params: Promise.resolve({ batchId }),
  });
}

async function seed(email: string) {
  const user = await db.user.create({ data: { email, passwordHash: 'x' } });
  const bench = await db.exercise.create({
    data: { userId: user.id, name: 'Bench', muscleGroup: 'CHEST', category: 'COMPOUND' },
  });
  const fly = await db.exercise.create({
    data: { userId: user.id, name: 'Fly', muscleGroup: 'CHEST', category: 'ISOLATION' },
  });
  const program = await db.program.create({
    data: { userId: user.id, name: 'P', phase: 'Base', isActive: true },
  });
  const workout = await db.workout.create({
    data: { programId: program.id, name: 'Push', order: 1 },
  });
  const prescription = {
    targetSets: 3,
    targetRepsMin: 8,
    targetRepsMax: 12,
    targetRIR: 2,
    restSec: 90,
  };
  const benchPe = await db.programExercise.create({
    data: { workoutId: workout.id, exerciseId: bench.id, order: 1, ...prescription },
  });
  const flyPe = await db.programExercise.create({
    data: { workoutId: workout.id, exerciseId: fly.id, order: 2, ...prescription },
  });
  return { user, workout, benchPe, flyPe };
}

async function namesInOrder(workoutId: string) {
  const rows = await db.programExercise.findMany({
    where: { workoutId },
    orderBy: { order: 'asc' },
    include: { exercise: { select: { name: true } } },
  });
  return rows.map((r) => r.exercise.name);
}

const addDips: Adjustment = {
  action: 'add',
  exerciseName: 'Dips',
  workoutName: 'Push',
  position: 2,
  muscleGroup: 'TRICEPS',
  category: 'COMPOUND',
  summary: 'Add dips for triceps volume',
  suggestedSets: 3,
  suggestedRepsMin: 6,
  suggestedRepsMax: 10,
  suggestedRIR: 2,
  suggestedRestSec: 120,
};

describe('structural coach changes', () => {
  it('adds an exercise at a position, creating it in the catalog, and undoes it', async () => {
    const { user, workout } = await seed('changes-add@test.dev');
    const result = await applyAdjustmentsToActiveProgram(user.id, [addDips], new Date(), 'chat');
    expect(result.applied).toEqual([
      expect.objectContaining({ exerciseName: 'Dips', action: 'add' }),
    ]);
    expect(await namesInOrder(workout.id)).toEqual(['Bench', 'Dips', 'Fly']);

    actAs(user.id);
    const res = await undo(result.batchId!);
    expect(res.status).toBe(200);
    expect(await namesInOrder(workout.id)).toEqual(['Bench', 'Fly']);
    // The catalog entry the add created is gone again (never used).
    expect(await db.exercise.count({ where: { userId: user.id, name: 'Dips' } })).toBe(0);
  });

  it('removes and moves, then restores the exact prior workout on undo', async () => {
    const { user, workout, benchPe } = await seed('changes-remove@test.dev');
    const result = await applyAdjustmentsToActiveProgram(user.id, [
      {
        action: 'move',
        exerciseName: 'Fly',
        workoutName: 'Push',
        position: 1,
        summary: 'Pre-exhaust',
      },
      { action: 'remove', exerciseName: 'Bench', summary: 'Drop bench this block' },
    ]);
    expect(result.skipped).toEqual([]);
    expect(await namesInOrder(workout.id)).toEqual(['Fly']);
    expect(await db.programChangeLog.count({ where: { batchId: result.batchId! } })).toBe(2);

    actAs(user.id);
    expect((await undo(result.batchId!)).status).toBe(200);
    expect(await namesInOrder(workout.id)).toEqual(['Bench', 'Fly']);
    const restored = await db.programExercise.findUniqueOrThrow({ where: { id: benchPe.id } });
    expect(restored.targetSets).toBe(3);
  });

  it('reverts an update to the previous prescription and notes', async () => {
    const { user, benchPe } = await seed('changes-update@test.dev');
    const result = await applyAdjustmentsToActiveProgram(user.id, [
      { exerciseName: 'Bench', summary: 'More sets', suggestedSets: 5 },
    ]);
    expect(
      (await db.programExercise.findUniqueOrThrow({ where: { id: benchPe.id } })).targetSets,
    ).toBe(5);

    actAs(user.id);
    await undo(result.batchId!);
    const after = await db.programExercise.findUniqueOrThrow({ where: { id: benchPe.id } });
    expect(after.targetSets).toBe(3);
    expect(after.notes).toBeNull();
  });

  it('never removes the last exercise of a workout, even across one batch', async () => {
    const { user, workout } = await seed('changes-last@test.dev');
    const result = await applyAdjustmentsToActiveProgram(user.id, [
      { action: 'remove', exerciseName: 'Bench', summary: 'a' },
      { action: 'remove', exerciseName: 'Fly', summary: 'b' },
    ]);
    expect(result.applied.map((a) => a.exerciseName)).toEqual(['Bench']);
    expect(result.skipped).toEqual([
      { exerciseName: 'Fly', reason: 'Cannot remove the last exercise of a workout.' },
    ]);
    expect(await namesInOrder(workout.id)).toEqual(['Fly']);
  });

  it('only undoes the latest batch, and only once', async () => {
    const { user } = await seed('changes-latest@test.dev');
    const first = await applyAdjustmentsToActiveProgram(user.id, [
      { exerciseName: 'Bench', summary: 'a', suggestedSets: 4 },
    ]);
    const second = await applyAdjustmentsToActiveProgram(user.id, [
      { exerciseName: 'Fly', summary: 'b', suggestedSets: 4 },
    ]);
    actAs(user.id);
    expect((await undo(first.batchId!)).status).toBe(409);
    expect((await undo(second.batchId!)).status).toBe(200);
    expect((await undo(second.batchId!)).status).toBe(409);
    expect((await undo(first.batchId!)).status).toBe(200);
  });
});

describe('undo route ownership', () => {
  it("returns 404 for another user's batch and leaves it intact", async () => {
    const owner = await seed('changes-owner@test.dev');
    const stranger = await db.user.create({
      data: { email: 'changes-stranger@test.dev', passwordHash: 'x' },
    });
    const result = await applyAdjustmentsToActiveProgram(owner.user.id, [addDips]);

    actAs(stranger.id);
    expect((await undo(result.batchId!)).status).toBe(404);
    expect(await namesInOrder(owner.workout.id)).toEqual(['Bench', 'Dips', 'Fly']);
    const logs = await db.programChangeLog.findMany({ where: { batchId: result.batchId! } });
    expect(logs.every((l) => l.undoneAt === null)).toBe(true);
  });
});
