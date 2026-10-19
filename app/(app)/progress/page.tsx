import { PageHeader } from '@/components/ui/page-header';
import { getTranslations } from 'next-intl/server';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { EmptyState } from '@/components/ui/empty-state';
import {
  applyBodyweight,
  best1RM,
  exerciseProgress,
  isStalled,
  isoWeekKey,
  trainingConsistency,
  weeklySetsByMuscleGroup,
  WEEKLY_SETS_MEV,
  WEEKLY_SETS_MRV,
} from '@/lib/stats';
import {
  DELOAD_READINESS_LOOKBACK,
  DELOAD_READINESS_MAX_AGE_DAYS,
  recommendDeload,
  isDeloadActive,
} from '@/lib/deload';
import { ProgressDashboard } from '@/components/progress/progress-dashboard';
import { ConsistencyCard } from '@/components/progress/consistency-card';
import { plannedDeloadEnd, programWeekInfo } from '@/lib/program-weeks';
import {
  ANCHOR_MAX_REPS,
  anchorRetention,
  bodyweightTrend,
  recompSignals,
  waistChange,
} from '@/lib/recomp';
import { RecompCard } from '@/components/progress/recomp-card';
import { WeeklySetsCard } from '@/components/progress/weekly-sets-card';
import { MuscleMapCard } from '@/components/progress/muscle-map-card';
import { plannedWeeklySets, weeklySetsRows } from '@/lib/weekly-sets';
import { buildMuscleMap } from '@/lib/muscle-map';
import { MeasurementsCard } from '@/components/progress/measurements-card';
import { PhotosCard } from '@/components/progress/photos-card';
import { DeloadBanner } from '@/components/progress/deload-banner';
import { BodyweightCard } from '@/components/progress/bodyweight-card';
import { SectionTabs } from '@/components/shared/section-tabs';

interface SearchParams {
  exerciseId?: string;
}

const RECENT_WEEKS = 12;

export default async function ProgressPage(
  props: {
    searchParams: Promise<SearchParams>;
  }
) {
  const t = await getTranslations('progress');
  const nav = await getTranslations('navigation');
  const searchParams = await props.searchParams;
  const auth = await requireSession();

  // Lower bound: 12 weeks before today (Monday 00:00).
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - RECENT_WEEKS * 7);

  const readinessSince = new Date();
  readinessSince.setUTCDate(readinessSince.getUTCDate() - DELOAD_READINESS_MAX_AGE_DAYS);

  // One batch instead of four sequential stages. Every read below is
  // independent of the others' results, and on a database a continent away
  // each extra stage was ~100 ms of pure latency.
  const [
    exercisesWithSets,
    user,
    activeSchedule,
    finishedSessions,
    windowSets,
    recentCheckins,
    bodyweightEntries,
    bodyMeasurements,
    progressPhotos,
    volumeTargetRows,
  ] = await Promise.all([
    // All exercises with at least one non-warmup set in the period.
    db.exercise.findMany({
      where: {
        userId: auth.userId,
        category: { not: 'CARDIO' },
        sets: {
          some: {
            isWarmup: false,
            completedAt: { gte: since },
            session: { userId: auth.userId },
          },
        },
      },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, muscleGroup: true, usesBodyweight: true },
    }),
    db.user.findUnique({
      where: { id: auth.userId },
      select: { bodyweight: true, unit: true, weeklyFrequency: true, deloadUntil: true },
    }),
    db.program.findFirst({
      where: { userId: auth.userId, isActive: true },
      select: {
        startDate: true,
        durationWeeks: true,
        deloadWeeks: true,
        // Planned weekly sets per muscle, and the heavy compounds that anchor
        // the recomp card's strength check.
        workouts: {
          select: {
            exercises: {
              orderBy: { order: 'asc' },
              select: {
                targetSets: true,
                targetRepsMax: true,
                exercise: {
                  select: {
                    id: true,
                    name: true,
                    usesBodyweight: true,
                    muscleGroup: true,
                    category: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    // Finished sessions over the window, for the consistency card.
    db.session.findMany({
      where: {
        userId: auth.userId,
        finishedAt: { not: null },
        startedAt: { gte: since },
      },
      select: { startedAt: true },
    }),
    // Every non-warmup strength set in the window, for the per-exercise recap
    // below. One query grouped in memory, not one query per exercise: the
    // fan-out cost a round trip for every exercise the user trains.
    db.set.findMany({
      where: {
        isWarmup: false,
        completedAt: { gte: since },
        session: { userId: auth.userId },
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
      },
    }),
    // Deload recommendation input.
    db.readinessCheckin.findMany({
      where: { userId: auth.userId, createdAt: { gte: readinessSince } },
      orderBy: { createdAt: 'desc' },
      take: DELOAD_READINESS_LOOKBACK,
      select: { readiness: true },
    }),
    // Bodyweight trend.
    db.bodyweightEntry.findMany({
      where: { userId: auth.userId, measuredAt: { gte: since } },
      orderBy: { measuredAt: 'desc' },
      select: { id: true, weightKg: true, measuredAt: true },
    }),
    // Tape measurements (waist trend for the recomp card + measurements card).
    db.bodyMeasurement.findMany({
      where: { userId: auth.userId, measuredAt: { gte: since } },
      orderBy: { measuredAt: 'desc' },
      select: { id: true, site: true, valueCm: true, measuredAt: true },
    }),
    // Every progress photo (a before/after compare wants the full timeline);
    // only metadata, the bytes stay behind the ownership-scoped route.
    db.progressPhoto.findMany({
      where: { userId: auth.userId },
      orderBy: { takenAt: 'desc' },
      select: { id: true, takenAt: true, note: true },
    }),
    // Personal MEV/MRV bands (issue #211) for the weekly sets card.
    db.volumeTarget.findMany({
      where: { userId: auth.userId },
      select: { muscleGroup: true, mev: true, mrv: true },
    }),
  ]);
  const bodyweight = user?.bodyweight ?? null;
  const unit = user?.unit ?? 'KG';

  const usesBodyweightById = new Map(
    exercisesWithSets.map((e) => [e.id, e.usesBodyweight]),
  );

  const consistency = trainingConsistency(
    finishedSessions.map((s) => s.startedAt),
    { weeklyFrequency: user?.weeklyFrequency ?? null, windowWeeks: RECENT_WEEKS },
  );

  const selectedExerciseId =
    searchParams.exerciseId ?? exercisesWithSets[0]?.id;

  // Max load + 1RM for the selected exercise.
  const [exerciseSets, selectedGoal] = await Promise.all([
    selectedExerciseId
      ? db.set.findMany({
          where: {
            exerciseId: selectedExerciseId,
            isWarmup: false,
            session: { userId: auth.userId },
          },
          orderBy: { completedAt: 'asc' },
          select: {
            weight: true,
            reps: true,
            isWarmup: true,
            durationSec: true,
            sessionId: true,
            session: { select: { startedAt: true } },
          },
        })
      : Promise.resolve([]),
    selectedExerciseId
      ? db.exerciseGoal.findUnique({
          where: {
            userId_exerciseId: { userId: auth.userId, exerciseId: selectedExerciseId },
          },
        })
      : Promise.resolve(null),
  ]);

  const selectedUsesBodyweight =
    selectedExerciseId != null
      ? (usesBodyweightById.get(selectedExerciseId) ?? false)
      : false;
  const adjustedExerciseSets = applyBodyweight(
    exerciseSets.map((s) => ({
      weight: s.weight,
      reps: s.reps,
      isWarmup: s.isWarmup,
      durationSec: s.durationSec,
      sessionId: s.sessionId,
      sessionStartedAt: s.session.startedAt,
      usesBodyweight: selectedUsesBodyweight,
    })),
    bodyweight,
  );
  const exercisePoints = exerciseProgress(adjustedExerciseSets);
  const selectedBestE1RM = best1RM(adjustedExerciseSets);

  // Recap: per-exercise stall detection, used for deload recommendation.
  const setsByExerciseId = new Map<string, typeof windowSets>();
  for (const s of windowSets) {
    const list = setsByExerciseId.get(s.exerciseId);
    if (list) list.push(s);
    else setsByExerciseId.set(s.exerciseId, [s]);
  }

  const recapRows = exercisesWithSets.map((exo) => {
      const sets = setsByExerciseId.get(exo.id) ?? [];
      const points = exerciseProgress(
        applyBodyweight(
          sets.map((s) => ({
            weight: s.weight,
            reps: s.reps,
            isWarmup: s.isWarmup,
            durationSec: s.durationSec,
            sessionId: s.sessionId,
            sessionStartedAt: s.session.startedAt,
            usesBodyweight: exo.usesBodyweight,
          })),
          bodyweight,
        ),
      );
      const first = points[0];
      const last = points[points.length - 1];
      if (!first || !last) return null;
      return {
        exerciseId: exo.id,
        exerciseName: exo.name,
        muscleGroup: exo.muscleGroup,
        sessions: points.length,
        firstWeight: first.maxWeight,
        firstDate: first.date,
        lastWeight: last.maxWeight,
        lastDate: last.date,
        weightDelta: +(last.maxWeight - first.maxWeight).toFixed(2),
        firstE1RM: first.estimated1RM,
        lastE1RM: last.estimated1RM,
        e1rmDelta: +(last.estimated1RM - first.estimated1RM).toFixed(1),
        stalled: isStalled(points.map((p) => p.estimated1RM)),
      };
  });
  const recap = recapRows.filter(
    (r): r is NonNullable<typeof r> => r !== null,
  );

  const deload = recommendDeload({
    stalledExerciseNames: recap
      .filter((r) => r.stalled)
      .map((r) => r.exerciseName),
    recentReadiness: recentCheckins.map((c) => c.readiness),
  });

  // The one-tap deload or a deload week scheduled on the active program.
  const now = new Date();
  const deloadUntilIso =
    plannedDeloadEnd(user?.deloadUntil ?? null, activeSchedule, now)?.toISOString() ?? null;
  const deloadActive = deloadUntilIso != null;
  const manualDeloadActive = isDeloadActive(user?.deloadUntil ?? null, now);
  const blockWeek = programWeekInfo(activeSchedule, now);

  // Recomp monitor (lib/recomp.ts): strength retention on the program's heavy
  // compounds next to the bodyweight and waist trend. Sessions inside a
  // scheduled deload week are lowered on purpose, so they are left out.
  const anchorExercises = new Map<string, { name: string; usesBodyweight: boolean }>();
  for (const w of activeSchedule?.workouts ?? []) {
    for (const pe of w.exercises) {
      if (pe.exercise.category === 'COMPOUND' && pe.targetRepsMax <= ANCHOR_MAX_REPS) {
        anchorExercises.set(pe.exercise.id, pe.exercise);
      }
    }
  }
  const blockStart = activeSchedule?.durationWeeks != null ? activeSchedule.startDate : null;
  const anchors = [...anchorExercises].map(([id, exo]) =>
    anchorRetention(
      {
        exerciseName: exo.name,
        points: exerciseProgress(
          applyBodyweight(
            (setsByExerciseId.get(id) ?? []).map((s) => ({
              weight: s.weight,
              reps: s.reps,
              isWarmup: s.isWarmup,
              durationSec: s.durationSec,
              sessionId: s.sessionId,
              sessionStartedAt: s.session.startedAt,
              usesBodyweight: exo.usesBodyweight,
            })),
            bodyweight,
          ),
        ).map((p) => ({ date: p.sessionStartedAt, e1RM: p.estimated1RM })),
      },
      {
        blockStart,
        windowStart: since,
        now,
        isExcluded: (date) => programWeekInfo(activeSchedule, date)?.isDeloadWeek ?? false,
      },
    ),
  );
  const bodyweightTrendValue = bodyweightTrend(bodyweightEntries, now);
  const waist = waistChange(
    bodyMeasurements.filter((m) => m.site === 'WAIST'),
    blockStart ?? since,
  );
  const signals = recompSignals({ anchors, bodyweight: bodyweightTrendValue, waist });

  // Weekly hard sets per muscle (lib/weekly-sets.ts): program plan vs this
  // week and last week, against personal or default MEV/MRV bands.
  const volumeTargets = Object.fromEntries(
    volumeTargetRows.map((v) => [v.muscleGroup, { mev: v.mev, mrv: v.mrv }]),
  );
  const muscleById = new Map(exercisesWithSets.map((e) => [e.id, e.muscleGroup]));
  const weeklySetsPoints = weeklySetsByMuscleGroup(
    windowSets.flatMap((s) => {
      const muscleGroup = muscleById.get(s.exerciseId);
      return muscleGroup
        ? [
            {
              isWarmup: s.isWarmup,
              durationSec: s.durationSec,
              muscleGroup,
              sessionStartedAt: s.session.startedAt,
            },
          ]
        : [];
    }),
  );
  const thisWeekKey = isoWeekKey(now);
  const lastWeekKey = isoWeekKey(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
  const lastWeekSets =
    weeklySetsPoints.find((w) => w.weekKey === lastWeekKey)?.byMuscleGroup ?? {};
  const weeklyRows = weeklySetsRows({
    planned: plannedWeeklySets(
      (activeSchedule?.workouts ?? []).map((w) => ({
        exercises: w.exercises.map((pe) => ({
          muscleGroup: pe.exercise.muscleGroup,
          category: pe.exercise.category,
          targetSets: pe.targetSets,
        })),
      })),
    ),
    thisWeek: weeklySetsPoints.find((w) => w.weekKey === thisWeekKey)?.byMuscleGroup ?? {},
    lastWeek: lastWeekSets,
    targets: volumeTargets,
  });
  const muscleMap = buildMuscleMap(lastWeekSets, volumeTargets);
  const lastWeekNumber = Number(lastWeekKey.split('-W')[1]);

  return (
    <main className="flex-1 px-4 py-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <PageHeader illustration="progress" title={t('title')} />

        {/* Reached from the history tab, so it carries the same segmented pair. */}
        <SectionTabs
          current="/progress"
          tabs={[
            { href: '/history', label: nav('history') },
            { href: '/progress', label: nav('progress') },
          ]}
        />

        <BodyweightCard
          entries={bodyweightEntries.map((e) => ({
            id: e.id,
            weightKg: e.weightKg,
            measuredAt: e.measuredAt.toISOString(),
          }))}
          unit={unit}
        />

        {activeSchedule && (
          <RecompCard
            anchors={anchors}
            bodyweight={bodyweightTrendValue}
            waist={waist}
            signals={signals}
            unit={unit}
          />
        )}

        <MeasurementsCard
          entries={bodyMeasurements.map((e) => ({
            id: e.id,
            site: e.site,
            valueCm: e.valueCm,
            measuredAt: e.measuredAt.toISOString(),
          }))}
          unit={unit}
        />

        <PhotosCard
          photos={progressPhotos.map((p) => ({
            id: p.id,
            takenAt: p.takenAt.toISOString(),
            note: p.note,
          }))}
        />

        {exercisesWithSets.length === 0 ? (
          <EmptyState
            illustration="progress"
            title={t('emptyTitle')}
            description={t('emptyDescription', { weeks: RECENT_WEEKS })}
            action={{ label: t('firstSession'), href: '/session/new' }}
          />
        ) : (
          <>
            {(deload.recommended || deloadActive) && (
              <DeloadBanner
                reasons={deload.reasons}
                deloadUntil={deloadUntilIso}
                scheduledWeek={blockWeek?.isDeloadWeek ? blockWeek.week : null}
                canEnd={manualDeloadActive}
              />
            )}
            <WeeklySetsCard
              rows={weeklyRows}
              defaultMev={WEEKLY_SETS_MEV}
              defaultMrv={WEEKLY_SETS_MRV}
            />
            {Object.keys(lastWeekSets).length > 0 && (
              <MuscleMapCard
                regions={muscleMap}
                weekLabel={t('dashboard.weekLabel', { week: lastWeekNumber })}
              />
            )}
            <ConsistencyCard
              weeks={consistency.weeks}
              currentStreak={consistency.currentStreak}
              weeklyFrequency={consistency.weeklyFrequency}
            />
            <ProgressDashboard
              exercises={exercisesWithSets.map((e) => ({
                id: e.id,
                name: e.name,
                muscleGroup: e.muscleGroup,
              }))}
              selectedExerciseId={selectedExerciseId}
              exercisePoints={exercisePoints}
              recap={recap}
              unit={unit}
              selectedGoal={
                selectedGoal
                  ? {
                      id: selectedGoal.id,
                      targetWeight: selectedGoal.targetWeight,
                      targetReps: selectedGoal.targetReps,
                      achievedAt: selectedGoal.achievedAt?.toISOString() ?? null,
                    }
                  : null
              }
              selectedBestE1RM={selectedBestE1RM}
              selectedUsesBodyweight={selectedUsesBodyweight}
            />
          </>
        )}
      </div>
    </main>
  );
}
