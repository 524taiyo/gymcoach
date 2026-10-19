import { db } from '@/lib/db';
import { programWeekInfo, type ProgramSchedule } from '@/lib/program-weeks';
import {
  ANCHOR_MAX_REPS,
  anchorRetention,
  bodyweightTrend,
  recompSignals,
  waistChange,
  type AnchorRetention,
  type BodyweightTrend,
  type RecompSignal,
  type WaistChange,
} from '@/lib/recomp';
import {
  applyBodyweight,
  exerciseProgress,
  isoWeekKey,
  weeklySetsByMuscleGroup,
} from '@/lib/stats';
import { plannedWeeklySets, weeklySetsRows, type WeeklySetsRow } from '@/lib/weekly-sets';

// ============================================================
// Recomp summary for the AI coach payload
// ============================================================
// The same signals the progress page shows (lib/recomp.ts, lib/weekly-sets.ts),
// assembled into one compact, serializable block so the coach reasons over the
// numbers the user sees. Deterministic: the coach explains them, it does not
// recompute them.

const DAY_MS = 24 * 60 * 60 * 1000;
// Same look-back as the progress page.
const WINDOW_WEEKS = 12;

export interface RecompSummary {
  strengthRetention: AnchorRetention[];
  bodyweightTrend: BodyweightTrend | null;
  waistChange: WaistChange | null;
  // Rule-based hypotheses (lib/recomp.ts recompSignals). Hypotheses, not facts.
  signals: RecompSignal[];
  // Planned vs logged working sets per primary muscle.
  weeklySets: Array<
    Pick<WeeklySetsRow, 'group' | 'planned' | 'thisWeek' | 'lastWeek' | 'mev' | 'mrv'>
  >;
}

export interface RecompSummaryInput {
  now: Date;
  schedule: ProgramSchedule | null;
  programExercises: Array<{
    targetSets: number;
    targetRepsMax: number;
    exercise: {
      id: string;
      name: string;
      muscleGroup: string;
      category: string;
      usesBodyweight: boolean;
    };
  }>;
  // Non-warmup strength sets of the window, oldest first.
  sets: Array<{
    exerciseId: string;
    muscleGroup: string;
    usesBodyweight: boolean;
    weight: number;
    reps: number;
    isWarmup: boolean;
    durationSec: number | null;
    sessionId: string;
    sessionStartedAt: Date;
  }>;
  bodyweight: number | null;
  bodyweightEntries: Array<{ weightKg: number; measuredAt: Date }>;
  waistEntries: Array<{ valueCm: number; measuredAt: Date }>;
  volumeTargets: Record<string, { mev: number; mrv: number }>;
}

// Pure assembly, shared shape with the progress page computations.
export function assembleRecompSummary(input: RecompSummaryInput): RecompSummary {
  const { now, schedule } = input;
  const windowStart = new Date(now.getTime() - WINDOW_WEEKS * 7 * DAY_MS);
  const blockStart = schedule?.durationWeeks != null ? schedule.startDate : null;

  const anchors = new Map<string, { name: string; usesBodyweight: boolean }>();
  for (const pe of input.programExercises) {
    if (pe.exercise.category === 'COMPOUND' && pe.targetRepsMax <= ANCHOR_MAX_REPS) {
      anchors.set(pe.exercise.id, pe.exercise);
    }
  }
  const strengthRetention = [...anchors].map(([id, exo]) =>
    anchorRetention(
      {
        exerciseName: exo.name,
        points: exerciseProgress(
          applyBodyweight(
            input.sets
              .filter((s) => s.exerciseId === id)
              .map((s) => ({ ...s, usesBodyweight: exo.usesBodyweight })),
            input.bodyweight,
          ),
        ).map((p) => ({ date: p.sessionStartedAt, e1RM: p.estimated1RM })),
      },
      {
        blockStart,
        windowStart,
        now,
        isExcluded: (date) => programWeekInfo(schedule, date)?.isDeloadWeek ?? false,
      },
    ),
  );
  const trend = bodyweightTrend(input.bodyweightEntries, now);
  const waist = waistChange(input.waistEntries, blockStart ?? windowStart);

  const weeks = weeklySetsByMuscleGroup(input.sets);
  const thisWeekKey = isoWeekKey(now);
  const lastWeekKey = isoWeekKey(new Date(now.getTime() - 7 * DAY_MS));
  const rows = weeklySetsRows({
    planned: plannedWeeklySets([
      {
        exercises: input.programExercises.map((pe) => ({
          muscleGroup: pe.exercise.muscleGroup,
          category: pe.exercise.category,
          targetSets: pe.targetSets,
        })),
      },
    ]),
    thisWeek: weeks.find((w) => w.weekKey === thisWeekKey)?.byMuscleGroup ?? {},
    lastWeek: weeks.find((w) => w.weekKey === lastWeekKey)?.byMuscleGroup ?? {},
    targets: input.volumeTargets,
  });

  return {
    strengthRetention,
    bodyweightTrend: trend,
    waistChange: waist,
    signals: recompSignals({ anchors: strengthRetention, bodyweight: trend, waist }),
    weeklySets: rows.map(({ group, planned, thisWeek, lastWeek, mev, mrv }) => ({
      group,
      planned,
      thisWeek,
      lastWeek,
      mev,
      mrv,
    })),
  };
}

// Loads the inputs for the user's active program. Null without one: the
// signals are only meaningful against a program's anchors and plan.
export async function fetchRecompSummary(
  userId: string,
  bodyweight: number | null,
  now: Date = new Date(),
): Promise<RecompSummary | null> {
  const program = await db.program.findFirst({
    where: { userId, isActive: true },
    select: {
      startDate: true,
      durationWeeks: true,
      deloadWeeks: true,
      workouts: {
        select: {
          exercises: {
            select: {
              targetSets: true,
              targetRepsMax: true,
              exercise: {
                select: {
                  id: true,
                  name: true,
                  muscleGroup: true,
                  category: true,
                  usesBodyweight: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (!program) return null;

  const since = new Date(now.getTime() - WINDOW_WEEKS * 7 * DAY_MS);
  const [sets, bodyweightEntries, waistEntries, targets] = await Promise.all([
    db.set.findMany({
      where: {
        isWarmup: false,
        completedAt: { gte: since },
        session: { userId },
        exercise: { category: { not: 'CARDIO' } },
      },
      orderBy: { completedAt: 'asc' },
      select: {
        exerciseId: true,
        weight: true,
        reps: true,
        isWarmup: true,
        durationSec: true,
        sessionId: true,
        session: { select: { startedAt: true } },
        exercise: { select: { muscleGroup: true, usesBodyweight: true } },
      },
    }),
    db.bodyweightEntry.findMany({
      where: { userId, measuredAt: { gte: since } },
      select: { weightKg: true, measuredAt: true },
    }),
    db.bodyMeasurement.findMany({
      where: { userId, site: 'WAIST', measuredAt: { gte: since } },
      select: { valueCm: true, measuredAt: true },
    }),
    db.volumeTarget.findMany({
      where: { userId },
      select: { muscleGroup: true, mev: true, mrv: true },
    }),
  ]);

  return assembleRecompSummary({
    now,
    schedule: program,
    programExercises: program.workouts.flatMap((w) => w.exercises),
    sets: sets.map((s) => ({
      exerciseId: s.exerciseId,
      muscleGroup: s.exercise.muscleGroup,
      usesBodyweight: s.exercise.usesBodyweight,
      weight: s.weight,
      reps: s.reps,
      isWarmup: s.isWarmup,
      durationSec: s.durationSec,
      sessionId: s.sessionId,
      sessionStartedAt: s.session.startedAt,
    })),
    bodyweight,
    bodyweightEntries,
    waistEntries,
    volumeTargets: Object.fromEntries(
      targets.map((t) => [t.muscleGroup, { mev: t.mev, mrv: t.mrv }]),
    ),
  });
}
