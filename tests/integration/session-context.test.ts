import { describe, it, expect } from 'vitest';
import { db } from '@/lib/db';
import { buildCurrentSessionContext, buildPlannedWorkoutContext } from '@/lib/coach';
import { READINESS_RECENCY_HOURS } from '@/lib/progression';

// In-session chat context (issue #111): the compact currentSession section the
// chat route attaches to the coach payload. Pure DB-derivation tests - the
// route only forwards the result, and ownership lives in the builder.

async function makeUser(email: string, bodyweight: number | null = null) {
  return db.user.create({ data: { email, passwordHash: 'x', bodyweight } });
}

// One program -> workout with one planned exercise (bench), one ad-hoc
// exercise (pull-ups, usesBodyweight) logged into the session on top of it.
async function seedLiveSession(userId: string) {
  const bench = await db.exercise.create({
    data: { userId, name: 'Bench', muscleGroup: 'CHEST', category: 'COMPOUND' },
  });
  const pullups = await db.exercise.create({
    data: {
      userId,
      name: 'Pull-ups',
      muscleGroup: 'BACK_WIDTH',
      category: 'COMPOUND',
      usesBodyweight: true,
    },
  });
  const program = await db.program.create({
    data: { userId, name: 'P', phase: 'Base', isActive: true },
  });
  const workout = await db.workout.create({
    data: { programId: program.id, name: 'Push day', order: 1 },
  });
  await db.programExercise.create({
    data: {
      workoutId: workout.id,
      exerciseId: bench.id,
      order: 1,
      targetSets: 3,
      targetRepsMin: 6,
      targetRepsMax: 10,
      targetRIR: 2,
      restSec: 150,
    },
  });
  const session = await db.session.create({
    data: {
      userId,
      workoutId: workout.id,
      startedAt: new Date('2026-06-11T10:00:00Z'),
    },
  });
  await db.set.create({
    data: {
      sessionId: session.id,
      exerciseId: bench.id,
      setNumber: 1,
      weight: 80,
      reps: 8,
      rir: 2,
    },
  });
  await db.set.create({
    data: {
      sessionId: session.id,
      exerciseId: bench.id,
      setNumber: 2,
      weight: 80,
      reps: 7,
      rir: 1,
      isDropSet: false,
    },
  });
  await db.set.create({
    data: {
      sessionId: session.id,
      exerciseId: pullups.id,
      setNumber: 1,
      weight: 0,
      reps: 10,
      isWarmup: false,
    },
  });
  return { session, workout, bench, pullups };
}

describe('buildCurrentSessionContext', () => {
  it('returns the compact live-session shape: workout, targets, sets logged in order', async () => {
    const user = await makeUser('ctx-shape@test.dev');
    const { session } = await seedLiveSession(user.id);

    const ctx = await buildCurrentSessionContext(user.id, session.id);
    expect(ctx).not.toBeNull();
    expect(ctx!.workoutName).toBe('Push day');
    expect(ctx!.startedAt).toBe('2026-06-11T10:00:00.000Z');
    expect(ctx!.readinessToday).toBeNull();

    // Planned exercise first (with its program targets), ad-hoc one after
    // (target null).
    expect(ctx!.exercises.map((e) => e.exerciseName)).toEqual(['Bench', 'Pull-ups']);
    const [benchCtx, pullupsCtx] = ctx!.exercises;
    expect(benchCtx!.target).toEqual({
      targetSets: 3,
      targetRepsMin: 6,
      targetRepsMax: 10,
      targetRIR: 2,
      restSec: 150,
    });
    expect(benchCtx!.setsLogged).toEqual([
      { setNumber: 1, weight: 80, reps: 8, rir: 2, isWarmup: false, isDropSet: false },
      { setNumber: 2, weight: 80, reps: 7, rir: 1, isWarmup: false, isDropSet: false },
    ]);
    expect(pullupsCtx!.target).toBeNull();
    expect(pullupsCtx!.setsLogged).toHaveLength(1);
  });

  it('reports effective loads for bodyweight exercises when the bodyweight is known', async () => {
    const user = await makeUser('ctx-bodyweight@test.dev', 82);
    const { session } = await seedLiveSession(user.id);

    const ctx = await buildCurrentSessionContext(user.id, session.id);
    const pullupsCtx = ctx!.exercises.find((e) => e.exerciseName === 'Pull-ups');
    // 0 added load + 82 kg bodyweight = 82 effective.
    expect(pullupsCtx!.setsLogged[0]!.weight).toBe(82);
    // Non-bodyweight loads are untouched.
    const benchCtx = ctx!.exercises.find((e) => e.exerciseName === 'Bench');
    expect(benchCtx!.setsLogged[0]!.weight).toBe(80);
  });

  it("ownership: returns null for another user's session and for an unknown id", async () => {
    const owner = await makeUser('ctx-owner@test.dev');
    const stranger = await makeUser('ctx-stranger@test.dev');
    const { session } = await seedLiveSession(owner.id);

    expect(await buildCurrentSessionContext(stranger.id, session.id)).toBeNull();
    expect(await buildCurrentSessionContext(owner.id, 'cl0000000000000000000000')).toBeNull();
  });

  it('includes a fresh readiness check-in and ignores a stale one', async () => {
    const user = await makeUser('ctx-readiness@test.dev');
    const { session } = await seedLiveSession(user.id);
    const now = new Date('2026-06-11T12:00:00Z');

    // Stale: outside the recency window that auto-regulates suggestions.
    await db.readinessCheckin.create({
      data: {
        userId: user.id,
        readiness: 1,
        sleepQuality: 1,
        createdAt: new Date(now.getTime() - (READINESS_RECENCY_HOURS + 2) * 60 * 60 * 1000),
      },
    });
    let ctx = await buildCurrentSessionContext(user.id, session.id, now);
    expect(ctx!.readinessToday).toBeNull();

    // Fresh: this morning's check-in rides along, soreness coerced to a map.
    await db.readinessCheckin.create({
      data: {
        userId: user.id,
        readiness: 3,
        sleepQuality: 4,
        soreness: { CHEST: 4 },
        createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      },
    });
    ctx = await buildCurrentSessionContext(user.id, session.id, now);
    expect(ctx!.readinessToday).toEqual({
      readiness: 3,
      sleepQuality: 4,
      soreness: { CHEST: 4 },
    });
  });

  it('handles a session without a workout (free session): no targets, sets still listed', async () => {
    const user = await makeUser('ctx-free@test.dev');
    const exercise = await db.exercise.create({
      data: { userId: user.id, name: 'Curl', muscleGroup: 'BICEPS', category: 'ISOLATION' },
    });
    const session = await db.session.create({ data: { userId: user.id } });
    await db.set.create({
      data: { sessionId: session.id, exerciseId: exercise.id, setNumber: 1, weight: 20, reps: 12 },
    });

    const ctx = await buildCurrentSessionContext(user.id, session.id);
    expect(ctx!.workoutName).toBeNull();
    expect(ctx!.exercises).toEqual([
      {
        exerciseName: 'Curl',
        muscleGroup: 'BICEPS',
        usesBodyweight: false,
        target: null,
        setsLogged: [
          { setNumber: 1, weight: 20, reps: 12, rir: null, isWarmup: false, isDropSet: false },
        ],
      },
    ]);
  });
});

// Pre-session chat context: the plannedWorkout section the chat route attaches
// when home links to /chat?workoutId=... . Same ownership contract as the live
// session builder, so the same class of tampering test applies.

// A program -> workout with bench (planned, with history) and pull-ups
// (planned, bodyweight). History is seeded separately per test.
async function seedPlannedWorkout(userId: string) {
  const bench = await db.exercise.create({
    data: { userId, name: 'Bench', muscleGroup: 'CHEST', category: 'COMPOUND' },
  });
  const pullups = await db.exercise.create({
    data: {
      userId,
      name: 'Pull-ups',
      muscleGroup: 'BACK_WIDTH',
      category: 'COMPOUND',
      usesBodyweight: true,
    },
  });
  const program = await db.program.create({
    data: { userId, name: 'Upper / Lower', phase: 'Base', isActive: true },
  });
  const workout = await db.workout.create({
    data: { programId: program.id, name: 'Upper', order: 1, dayOfWeek: 1 },
  });
  await db.programExercise.create({
    data: {
      workoutId: workout.id,
      exerciseId: bench.id,
      order: 1,
      targetSets: 4,
      targetRepsMin: 6,
      targetRepsMax: 10,
      targetRIR: 2,
      restSec: 150,
    },
  });
  await db.programExercise.create({
    data: {
      workoutId: workout.id,
      exerciseId: pullups.id,
      order: 2,
      targetSets: 3,
      targetRepsMin: 8,
      targetRepsMax: 12,
      targetRIR: 1,
      restSec: 120,
    },
  });
  return { program, workout, bench, pullups };
}

describe('buildPlannedWorkoutContext', () => {
  it('returns the planned shape: program targets in workout order', async () => {
    const user = await makeUser('planned-shape@test.dev');
    const { workout } = await seedPlannedWorkout(user.id);

    const ctx = await buildPlannedWorkoutContext(user.id, workout.id);
    expect(ctx).not.toBeNull();
    expect(ctx!.workoutName).toBe('Upper');
    expect(ctx!.programName).toBe('Upper / Lower');
    expect(ctx!.dayOfWeek).toBe(1);
    expect(ctx!.exercises.map((e) => e.exerciseName)).toEqual(['Bench', 'Pull-ups']);
    expect(ctx!.exercises[0]!.target).toEqual({
      targetSets: 4,
      targetRepsMin: 6,
      targetRepsMax: 10,
      targetRIR: 2,
      restSec: 150,
    });
    // Never trained: no last performance to anchor on.
    expect(ctx!.exercises[0]!.lastPerformed).toBeNull();
  });

  it('attaches the top working set of the most recent finished session', async () => {
    const user = await makeUser('planned-history@test.dev');
    const { workout, bench } = await seedPlannedWorkout(user.id);
    const now = new Date('2026-06-20T10:00:00Z');

    // Older session, heavier: must NOT win over the more recent one.
    const older = await db.session.create({
      data: {
        userId: user.id,
        startedAt: new Date('2026-06-06T10:00:00Z'),
        finishedAt: new Date('2026-06-06T11:00:00Z'),
      },
    });
    await db.set.create({
      data: { sessionId: older.id, exerciseId: bench.id, setNumber: 1, weight: 100, reps: 5 },
    });

    // Most recent session: a warm-up, then two working sets.
    const recent = await db.session.create({
      data: {
        userId: user.id,
        startedAt: new Date('2026-06-17T10:00:00Z'),
        finishedAt: new Date('2026-06-17T11:00:00Z'),
      },
    });
    await db.set.create({
      data: {
        sessionId: recent.id,
        exerciseId: bench.id,
        setNumber: 1,
        weight: 60,
        reps: 10,
        isWarmup: true,
      },
    });
    await db.set.create({
      data: { sessionId: recent.id, exerciseId: bench.id, setNumber: 2, weight: 85, reps: 8, rir: 2 },
    });
    await db.set.create({
      data: { sessionId: recent.id, exerciseId: bench.id, setNumber: 3, weight: 82.5, reps: 8 },
    });

    const ctx = await buildPlannedWorkoutContext(user.id, workout.id, now);
    const benchCtx = ctx!.exercises.find((e) => e.exerciseName === 'Bench');
    expect(benchCtx!.lastPerformed).toEqual({
      date: '2026-06-17',
      daysAgo: 3,
      topSetWeight: 85,
      topSetReps: 8,
      rir: 2,
      // Epley on the top set: 85 x (1 + 8/30) = 107.666... -> 107.7
      estimated1RM: 107.7,
      // Warm-ups excluded.
      setCount: 2,
    });
  });

  it('reports effective loads for bodyweight exercises', async () => {
    const user = await makeUser('planned-bodyweight@test.dev', 82);
    const { workout, pullups } = await seedPlannedWorkout(user.id);
    const session = await db.session.create({
      data: {
        userId: user.id,
        startedAt: new Date('2026-06-17T10:00:00Z'),
        finishedAt: new Date('2026-06-17T11:00:00Z'),
      },
    });
    await db.set.create({
      data: { sessionId: session.id, exerciseId: pullups.id, setNumber: 1, weight: 0, reps: 10 },
    });

    const ctx = await buildPlannedWorkoutContext(user.id, workout.id, new Date('2026-06-20T10:00:00Z'));
    const pullupsCtx = ctx!.exercises.find((e) => e.exerciseName === 'Pull-ups');
    // 0 added load + 82 kg bodyweight = 82 effective.
    expect(pullupsCtx!.lastPerformed!.topSetWeight).toBe(82);
  });

  it('ignores sessions that were never finished', async () => {
    const user = await makeUser('planned-unfinished@test.dev');
    const { workout, bench } = await seedPlannedWorkout(user.id);
    const running = await db.session.create({
      data: { userId: user.id, startedAt: new Date('2026-06-17T10:00:00Z') },
    });
    await db.set.create({
      data: { sessionId: running.id, exerciseId: bench.id, setNumber: 1, weight: 85, reps: 8 },
    });

    const ctx = await buildPlannedWorkoutContext(user.id, workout.id);
    expect(ctx!.exercises.find((e) => e.exerciseName === 'Bench')!.lastPerformed).toBeNull();
  });

  it("ownership: returns null for another user's workout and for an unknown id", async () => {
    const owner = await makeUser('planned-owner@test.dev');
    const stranger = await makeUser('planned-stranger@test.dev');
    const { workout } = await seedPlannedWorkout(owner.id);

    expect(await buildPlannedWorkoutContext(stranger.id, workout.id)).toBeNull();
    expect(await buildPlannedWorkoutContext(owner.id, 'cl0000000000000000000000')).toBeNull();
  });
});
