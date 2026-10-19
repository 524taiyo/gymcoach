import { db } from '@/lib/db';
import { ApiError } from '@/lib/api';
import type { Prisma } from '@/lib/prisma-client';
import type { Adjustment } from '@/lib/coach-adjustments';
import {
  orderedIds,
  ordersOf,
  placeAt,
  planProgramChanges,
  type SnapshotWorkout,
} from '@/lib/program-changes';

// Applying coach-proposed adjustments to the active program.
//
// Shared by POST /api/coach/[id]/apply and the chat apply route so the weekly
// debrief and the chat have ONE write path: the same ownership scoping, the
// same dated note trail, the same change log. The plan itself is pure
// (lib/program-changes.ts); this module runs it in one transaction and records
// every change in ProgramChangeLog under a batchId, so the user can undo the
// whole batch (undoProgramChangeBatch below).

export interface AppliedAdjustment {
  exerciseName: string;
  programExerciseIds: string[];
  // Present for structural changes; updates keep the original shape.
  action?: 'add' | 'remove' | 'move';
}

export interface SkippedAdjustment {
  exerciseName: string;
  reason: string;
}

export interface ApplyResult {
  applied: AppliedAdjustment[];
  skipped: SkippedAdjustment[];
  // Change-log batch to pass to the undo route; null when nothing was applied.
  batchId: string | null;
}

export type ChangeSource = 'debrief' | 'chat';

// Prescription fields snapshotted for update undo.
const PRESCRIPTION_KEYS = [
  'targetSets',
  'targetRepsMin',
  'targetRepsMax',
  'targetRIR',
  'restSec',
  'notes',
] as const;

type Tx = Prisma.TransactionClient;

async function writeOrders(tx: Tx, orders: Record<string, number>): Promise<void> {
  for (const [id, order] of Object.entries(orders)) {
    await tx.programExercise.update({ where: { id }, data: { order } });
  }
}

// Throws ApiError(400) when there is no active program to write to.
export async function applyAdjustmentsToActiveProgram(
  userId: string,
  adjustments: Adjustment[],
  now: Date = new Date(),
  source: ChangeSource = 'debrief',
): Promise<ApplyResult> {
  const program = await db.program.findFirst({
    where: { userId, isActive: true },
    include: {
      workouts: {
        orderBy: { order: 'asc' },
        include: {
          exercises: {
            orderBy: { order: 'asc' },
            include: { exercise: { select: { id: true, name: true } } },
          },
        },
      },
    },
  });
  if (!program) {
    throw new ApiError(400, 'No active program to apply the adjustments to.');
  }

  const snapshot: SnapshotWorkout[] = program.workouts.map((w) => ({
    id: w.id,
    name: w.name,
    exercises: w.exercises.map((pe) => ({
      id: pe.id,
      order: pe.order,
      exerciseId: pe.exerciseId,
      exerciseName: pe.exercise.name,
      targetSets: pe.targetSets,
      targetRepsMin: pe.targetRepsMin,
      targetRepsMax: pe.targetRepsMax,
      targetRIR: pe.targetRIR,
      restSec: pe.restSec,
      notes: pe.notes,
    })),
  }));
  const { changes, skipped } = planProgramChanges(
    snapshot,
    adjustments,
    now.toISOString().slice(0, 10),
  );
  if (changes.length === 0) return { applied: [], skipped, batchId: null };

  const batchId = `batch_${now.getTime().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  const applied: AppliedAdjustment[] = [];

  await db.$transaction(
    async (tx) => {
      // Live ordering per workout, updated as changes run in sequence.
      const order = new Map(snapshot.map((w) => [w.id, orderedIds(w.exercises)]));
      let seq = 0;
      const log = (data: {
        action: string;
        exerciseName: string;
        workoutName: string | null;
        before: Prisma.InputJsonValue | null;
        after: Prisma.InputJsonValue | null;
      }) =>
        tx.programChangeLog.create({
          data: {
            userId,
            programId: program.id,
            batchId,
            source,
            action: data.action,
            exerciseName: data.exerciseName,
            workoutName: data.workoutName,
            ...(data.before !== null ? { before: data.before } : {}),
            ...(data.after !== null ? { after: data.after } : {}),
            // Strictly increasing so undo can replay the batch in reverse.
            createdAt: new Date(now.getTime() + seq++),
          },
        });

      for (const change of changes) {
        const name = change.adjustment.exerciseName;
        if (change.action === 'update') {
          const ids: string[] = [];
          for (const target of change.targets) {
            const before = Object.fromEntries(
              PRESCRIPTION_KEYS.map((k) => [k, target.exercise[k]]),
            ) as Record<string, unknown>;
            await tx.programExercise.update({
              where: { id: target.exercise.id },
              data: target.patch,
            });
            await log({
              action: 'update',
              exerciseName: name,
              workoutName: target.workout.name,
              before: { id: target.exercise.id, ...before } as Prisma.InputJsonValue,
              after: { id: target.exercise.id, ...target.patch } as Prisma.InputJsonValue,
            });
            ids.push(target.exercise.id);
          }
          applied.push({ exerciseName: name, programExerciseIds: ids });
          continue;
        }

        const ids = order.get(change.workout.id) ?? [];
        const ordersBefore = ordersOf(ids);

        if (change.action === 'add') {
          const a = change.adjustment;
          const existing = await tx.exercise.findFirst({
            where: { userId, name },
            select: { id: true },
          });
          const exerciseId =
            existing?.id ??
            (
              await tx.exercise.create({
                data: {
                  userId,
                  name,
                  muscleGroup: a.muscleGroup ?? 'OTHER',
                  category: a.category ?? 'COMPOUND',
                },
                select: { id: true },
              })
            ).id;
          const created = await tx.programExercise.create({
            data: {
              workoutId: change.workout.id,
              exerciseId,
              order: ids.length + 1,
              targetSets: a.suggestedSets!,
              targetRepsMin: Math.min(a.suggestedRepsMin!, a.suggestedRepsMax!),
              targetRepsMax: Math.max(a.suggestedRepsMin!, a.suggestedRepsMax!),
              targetRIR: a.suggestedRIR!,
              restSec: a.suggestedRestSec!,
              notes: a.note?.trim() || null,
            },
            select: { id: true },
          });
          const next = placeAt([...ids, created.id], created.id, change.position);
          await writeOrders(tx, ordersOf(next));
          order.set(change.workout.id, next);
          await log({
            action: 'add',
            exerciseName: name,
            workoutName: change.workout.name,
            before: { orders: ordersBefore },
            after: { id: created.id, createdExerciseId: existing ? null : exerciseId },
          });
          applied.push({ exerciseName: name, programExerciseIds: [created.id], action: 'add' });
          continue;
        }

        if (change.action === 'remove') {
          const row = await tx.programExercise.findUniqueOrThrow({
            where: { id: change.exercise.id },
          });
          await tx.programExercise.delete({ where: { id: row.id } });
          const next = ids.filter((id) => id !== row.id);
          await writeOrders(tx, ordersOf(next));
          order.set(change.workout.id, next);
          await log({
            action: 'remove',
            exerciseName: name,
            workoutName: change.workout.name,
            before: { row: JSON.parse(JSON.stringify(row)), orders: ordersBefore },
            after: null,
          });
          applied.push({ exerciseName: name, programExerciseIds: [row.id], action: 'remove' });
          continue;
        }

        const next = placeAt(ids, change.exercise.id, change.position);
        await writeOrders(tx, ordersOf(next));
        order.set(change.workout.id, next);
        await log({
          action: 'move',
          exerciseName: name,
          workoutName: change.workout.name,
          before: { orders: ordersBefore },
          after: { orders: ordersOf(next) },
        });
        applied.push({
          exerciseName: name,
          programExerciseIds: [change.exercise.id],
          action: 'move',
        });
      }
    },
    // Each change is a few round trips; a remote database needs more than the
    // 5 s default (see lib/program-generation.ts).
    { timeout: 20_000, maxWait: 10_000 },
  );

  return { applied, skipped, batchId };
}

// ============================================================
// Undo
// ============================================================

export interface UndoResult {
  undone: number;
  // Changes that could not be reverted because their rows changed since.
  skipped: number;
}

// Reverts one applied batch, newest change first. Only the most recent
// not-yet-undone batch of its program can be undone, so an undo never
// unwinds a change that a later batch built on.
export async function undoProgramChangeBatch(
  userId: string,
  batchId: string,
  now: Date = new Date(),
): Promise<UndoResult> {
  const logs = await db.programChangeLog.findMany({
    where: { userId, batchId },
    orderBy: { createdAt: 'desc' },
  });
  const first = logs[0];
  if (!first) throw new ApiError(404, 'Change batch not found.');
  if (logs.some((l) => l.undoneAt)) throw new ApiError(409, 'This change was already undone.');

  const latest = await db.programChangeLog.findFirst({
    where: { userId, programId: first.programId, undoneAt: null },
    orderBy: { createdAt: 'desc' },
    select: { batchId: true },
  });
  if (latest?.batchId !== batchId) {
    throw new ApiError(409, 'Only the most recent change can be undone.');
  }

  let undone = 0;
  let skipped = 0;
  await db.$transaction(
    async (tx) => {
      const inProgram = { workout: { programId: first.programId, program: { userId } } };
      const restoreOrders = async (orders: Record<string, number> | undefined) => {
        for (const [id, order] of Object.entries(orders ?? {})) {
          await tx.programExercise.updateMany({ where: { id, ...inProgram }, data: { order } });
        }
      };

      for (const entry of logs) {
        const before = (entry.before ?? {}) as Record<string, unknown>;
        const after = (entry.after ?? {}) as Record<string, unknown>;
        if (entry.action === 'update') {
          const { id, ...fields } = before as { id: string } & Record<string, unknown>;
          const res = await tx.programExercise.updateMany({
            where: { id, ...inProgram },
            data: fields as Prisma.ProgramExerciseUpdateManyMutationInput,
          });
          if (res.count === 1) undone++;
          else skipped++;
        } else if (entry.action === 'add') {
          const res = await tx.programExercise.deleteMany({
            where: { id: after.id as string, ...inProgram },
          });
          // An exercise the add created for the catalog goes too, unless it has
          // been used since (sets or other program rows reference it).
          const createdExerciseId = after.createdExerciseId as string | null | undefined;
          if (createdExerciseId) {
            const [sets, uses] = await Promise.all([
              tx.set.count({ where: { exerciseId: createdExerciseId } }),
              tx.programExercise.count({ where: { exerciseId: createdExerciseId } }),
            ]);
            if (sets === 0 && uses === 0) {
              await tx.exercise.deleteMany({ where: { id: createdExerciseId, userId } });
            }
          }
          await restoreOrders(before.orders as Record<string, number> | undefined);
          if (res.count === 1) undone++;
          else skipped++;
        } else if (entry.action === 'remove') {
          const row = before.row as Record<string, unknown> & {
            id: string;
            workoutId: string;
            exerciseId: string;
          };
          const [workout, exercise] = await Promise.all([
            tx.workout.findFirst({ where: { id: row.workoutId, programId: first.programId } }),
            tx.exercise.findFirst({ where: { id: row.exerciseId, userId } }),
          ]);
          if (workout && exercise) {
            await tx.programExercise.create({
              data: row as unknown as Prisma.ProgramExerciseUncheckedCreateInput,
            });
            await restoreOrders(before.orders as Record<string, number> | undefined);
            undone++;
          } else {
            skipped++;
          }
        } else if (entry.action === 'move') {
          await restoreOrders(before.orders as Record<string, number> | undefined);
          undone++;
        }
      }
      await tx.programChangeLog.updateMany({ where: { userId, batchId }, data: { undoneAt: now } });
    },
    { timeout: 20_000, maxWait: 10_000 },
  );

  return { undone, skipped };
}
