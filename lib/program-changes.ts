import type { Adjustment, AdjustmentAction } from '@/lib/coach-adjustments';

// ============================================================
// Planning coach-proposed program changes (pure)
// ============================================================
// Turns approved adjustments into concrete operations against a snapshot of
// the active program, or skips them with a reason. No DB access: the executor
// in lib/coach-apply.ts runs the plan inside a transaction and logs every
// change for undo. Rules:
// - update: retunes every occurrence of the exercise (or only the one in
//   workoutName when given). Unknown exercise = skipped, never created.
// - add: inserts into the named workout at `position` (default: end). Skipped
//   when the workout does not exist or already contains the exercise.
// - remove / move: need the exercise to resolve to exactly one row (use
//   workoutName to disambiguate). Remove never deletes the last exercise of a
//   workout (a workout with no exercises cannot be started).

export const NOT_FOUND_REASON = 'Exercise not found in the active program.';

export interface SnapshotExercise {
  id: string;
  order: number;
  exerciseId: string;
  exerciseName: string;
  targetSets: number;
  targetRepsMin: number;
  targetRepsMax: number;
  targetRIR: number;
  restSec: number;
  notes: string | null;
}

export interface SnapshotWorkout {
  id: string;
  name: string;
  exercises: SnapshotExercise[];
}

export interface PrescriptionPatch {
  targetRepsMin?: number;
  targetRepsMax?: number;
  targetSets?: number;
  targetRIR?: number;
  restSec?: number;
  notes?: string;
}

export type PlannedChange =
  | {
      action: 'update';
      adjustment: Adjustment;
      targets: Array<{
        workout: SnapshotWorkout;
        exercise: SnapshotExercise;
        patch: PrescriptionPatch;
      }>;
    }
  | { action: 'add'; adjustment: Adjustment; workout: SnapshotWorkout; position: number }
  | {
      action: 'remove';
      adjustment: Adjustment;
      workout: SnapshotWorkout;
      exercise: SnapshotExercise;
    }
  | {
      action: 'move';
      adjustment: Adjustment;
      workout: SnapshotWorkout;
      exercise: SnapshotExercise;
      position: number;
    };

export interface SkippedChange {
  exerciseName: string;
  reason: string;
}

export function actionOf(adjustment: Adjustment): AdjustmentAction {
  return adjustment.action ?? 'update';
}

// The prescription fields an update writes, with a reversed rep range swapped
// back into order (the AI can be wrong; never persist min > max).
export function prescriptionPatch(
  adjustment: Adjustment,
  current: SnapshotExercise,
  today: string,
): PrescriptionPatch {
  const patch: PrescriptionPatch = {};
  if (adjustment.suggestedRepsMin != null) patch.targetRepsMin = adjustment.suggestedRepsMin;
  if (adjustment.suggestedRepsMax != null) patch.targetRepsMax = adjustment.suggestedRepsMax;
  if (adjustment.suggestedSets != null) patch.targetSets = adjustment.suggestedSets;
  if (adjustment.suggestedRIR != null) patch.targetRIR = adjustment.suggestedRIR;
  if (adjustment.suggestedRestSec != null) patch.restSec = adjustment.suggestedRestSec;
  if (
    patch.targetRepsMin != null &&
    patch.targetRepsMax != null &&
    patch.targetRepsMin > patch.targetRepsMax
  ) {
    [patch.targetRepsMin, patch.targetRepsMax] = [patch.targetRepsMax, patch.targetRepsMin];
  }
  const noteLine = coachNoteLine(today, adjustment);
  if (noteLine) patch.notes = current.notes ? `${noteLine}\n${current.notes}` : noteLine;
  return patch;
}

// Dated line prepended to the exercise notes, so the history stays readable.
export function coachNoteLine(today: string, adjustment: Adjustment): string | null {
  const parts: string[] = [];
  if (adjustment.note?.trim()) parts.push(adjustment.note.trim());
  else parts.push(adjustment.summary.trim());
  if (adjustment.suggestedLoad != null) parts.push(`Target: ${adjustment.suggestedLoad} kg`);
  if (parts.length === 0) return null;
  return `[Coach ${today}] ${parts.join(' · ')}`;
}

function rowsNamed(workouts: SnapshotWorkout[], adjustment: Adjustment) {
  return workouts.flatMap((workout) =>
    adjustment.workoutName && workout.name !== adjustment.workoutName
      ? []
      : workout.exercises
          .filter((e) => e.exerciseName === adjustment.exerciseName)
          .map((exercise) => ({ workout, exercise })),
  );
}

export function planProgramChanges(
  workouts: SnapshotWorkout[],
  adjustments: Adjustment[],
  today: string,
): { changes: PlannedChange[]; skipped: SkippedChange[] } {
  const changes: PlannedChange[] = [];
  const skipped: SkippedChange[] = [];
  const skip = (adjustment: Adjustment, reason: string) =>
    skipped.push({ exerciseName: adjustment.exerciseName, reason });
  // Live view of each workout as the batch is planned, so later changes see
  // earlier ones (two removals cannot empty a workout, an add is not doubled).
  const live = new Map(workouts.map((w) => [w.id, w.exercises.map((e) => e.exerciseName)]));
  const removed = new Set<string>();

  for (const adjustment of adjustments) {
    const action = actionOf(adjustment);
    if (action === 'add') {
      const workout = workouts.find((w) => w.name === adjustment.workoutName);
      if (!workout) {
        skip(adjustment, 'Workout not found in the active program.');
        continue;
      }
      const names = live.get(workout.id)!;
      if (names.includes(adjustment.exerciseName)) {
        skip(adjustment, 'Exercise is already in this workout.');
        continue;
      }
      names.push(adjustment.exerciseName);
      const end = names.length;
      changes.push({
        action,
        adjustment,
        workout,
        position: Math.min(adjustment.position ?? end, end),
      });
      continue;
    }

    const rows = rowsNamed(workouts, adjustment).filter(
      ({ exercise }) => !removed.has(exercise.id),
    );
    if (rows.length === 0) {
      skip(adjustment, NOT_FOUND_REASON);
      continue;
    }
    if (action === 'update') {
      changes.push({
        action,
        adjustment,
        targets: rows.map(({ workout, exercise }) => ({
          workout,
          exercise,
          patch: prescriptionPatch(adjustment, exercise, today),
        })),
      });
      continue;
    }
    if (rows.length > 1) {
      skip(adjustment, 'Exercise appears in several workouts; name the workout.');
      continue;
    }
    const { workout, exercise } = rows[0]!;
    const names = live.get(workout.id)!;
    if (action === 'remove') {
      if (names.length <= 1) {
        skip(adjustment, 'Cannot remove the last exercise of a workout.');
        continue;
      }
      names.splice(names.indexOf(exercise.exerciseName), 1);
      removed.add(exercise.id);
      changes.push({ action, adjustment, workout, exercise });
      continue;
    }
    changes.push({
      action,
      adjustment,
      workout,
      exercise,
      position: Math.min(adjustment.position!, names.length),
    });
  }
  return { changes, skipped };
}

// ------------------------------------------------------------
// Ordering helpers shared by apply and undo
// ------------------------------------------------------------

// Current order of a workout's rows (ids by ascending `order`).
export function orderedIds(exercises: Pick<SnapshotExercise, 'id' | 'order'>[]): string[] {
  return [...exercises].sort((a, b) => a.order - b.order).map((e) => e.id);
}

// Inserts `id` at the 1-based `position` (clamped), removing it first if present.
export function placeAt(ids: string[], id: string, position: number): string[] {
  const rest = ids.filter((x) => x !== id);
  const index = Math.max(0, Math.min(position - 1, rest.length));
  return [...rest.slice(0, index), id, ...rest.slice(index)];
}

// id -> 1-based order for a sequence.
export function ordersOf(ids: string[]): Record<string, number> {
  return Object.fromEntries(ids.map((id, i) => [id, i + 1]));
}

// ------------------------------------------------------------
// History view
// ------------------------------------------------------------

export interface ChangeLogRow {
  batchId: string;
  source: string;
  action: string;
  exerciseName: string;
  workoutName: string | null;
  createdAt: Date;
  undoneAt: Date | null;
}

export interface ChangeBatchView {
  batchId: string;
  source: string;
  appliedAt: string;
  undone: boolean;
  // Only the newest batch that is still applied can be undone.
  undoable: boolean;
  items: Array<{ action: string; exerciseName: string; workoutName: string | null }>;
}

// Groups change-log rows (any order) into batches, newest first, keeping at
// most `limit` batches. An update applied to several workouts collapses to one
// item per (action, exercise).
export function groupChangeBatches(rows: ChangeLogRow[], limit = 5): ChangeBatchView[] {
  const byBatch = new Map<string, ChangeLogRow[]>();
  for (const row of [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
    const list = byBatch.get(row.batchId);
    if (list) list.push(row);
    else byBatch.set(row.batchId, [row]);
  }
  const batches = [...byBatch.values()]
    .map((list) => {
      const first = list[0]!;
      const seen = new Set<string>();
      const items = list.flatMap((r) => {
        const key = `${r.action}:${r.exerciseName}`;
        if (seen.has(key)) return [];
        seen.add(key);
        return [{ action: r.action, exerciseName: r.exerciseName, workoutName: r.workoutName }];
      });
      return {
        batchId: first.batchId,
        source: first.source,
        appliedAt: first.createdAt.toISOString(),
        undone: list.some((r) => r.undoneAt != null),
        undoable: false,
        items,
      };
    })
    .sort((a, b) => b.appliedAt.localeCompare(a.appliedAt));
  const latestLive = batches.find((b) => !b.undone);
  if (latestLive) latestLive.undoable = true;
  return batches.slice(0, limit);
}
