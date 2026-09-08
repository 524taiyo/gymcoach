import { describe, expect, it } from 'vitest';
import { compactDailyTipSnapshot, DAILY_TIP_MAX_CHARS, sanitizeDailyTip } from './daily-tip';
import type { CoachPayload } from './coach';

describe('sanitizeDailyTip', () => {
  it('keeps the first non-empty line and trims wrapping quotes', () => {
    expect(sanitizeDailyTip('\n"Bench is up, ride it today."\nSecond line')).toBe(
      'Bench is up, ride it today.',
    );
  });

  it('strips Japanese quotation marks and markdown emphasis', () => {
    expect(sanitizeDailyTip('「**今日は脚の日**、スクワットに集中しよう。」')).toBe(
      '今日は脚の日、スクワットに集中しよう。',
    );
  });

  it('drops a leading list marker', () => {
    expect(sanitizeDailyTip('- Go lift.')).toBe('Go lift.');
    expect(sanitizeDailyTip('1. Go lift.')).toBe('Go lift.');
  });

  it('caps runaway output', () => {
    const long = 'a'.repeat(DAILY_TIP_MAX_CHARS + 50);
    const out = sanitizeDailyTip(long);
    expect(out.length).toBe(DAILY_TIP_MAX_CHARS);
    expect(out.endsWith('…')).toBe(true);
  });

  it('returns an empty string for empty output', () => {
    expect(sanitizeDailyTip('   \n  ')).toBe('');
  });
});

function payloadFixture(): CoachPayload {
  const session = (startedAt: string, workoutName: string | null, volume: number) => ({
    sessionId: `s-${startedAt}`,
    workoutName,
    startedAt,
    finishedAt: startedAt,
    durationMin: 60,
    notes: null,
    totalVolume: volume,
    workingSetCount: 12,
    exercises: [
      {
        exerciseName: 'Bench press',
        muscleGroup: 'CHEST',
        sets: [],
        bestE1RM: 100.4,
        volume: volume / 2,
      },
      {
        exerciseName: 'Squat',
        muscleGroup: 'QUADS',
        sets: [],
        bestE1RM: 140.2,
        volume: volume / 2,
      },
    ],
  });
  return {
    generatedAt: '2026-09-08T00:00:00.000Z',
    userProfile: {
      displayName: 'Taiyo',
      sex: null,
      heightCm: null,
      bodyweight: 80,
      goal: 'STRENGTH',
      weeklyFrequency: 4,
      coachNote: null,
    },
    weekCurrent: {
      weekStart: '2026-09-07',
      sessions: [
        session('2026-09-07T10:00:00.000Z', 'Push', 5000.4),
        session('2026-09-08T10:00:00.000Z', 'Pull', 4000.6),
      ],
    },
    weekPrevious: { weekStart: '2026-08-31', sessions: [session('2026-09-01T10:00:00.000Z', 'Legs', 6000)] },
    activeProgram: {
      name: 'PPL',
      workouts: [
        { name: 'Push', dayOfWeek: 1, exercises: [] },
        { name: 'Pull', dayOfWeek: 2, exercises: [] },
        { name: 'Legs', dayOfWeek: 7, exercises: [] },
      ],
    },
    latestReadiness: {
      date: '2026-09-08',
      daysAgo: 0,
      readiness: 4,
      sleepQuality: 3,
      soreness: null,
      note: 'slept late',
    },
    goals: [
      { exerciseName: 'Bench press', targetWeight: 100, targetReps: 5, progressPct: 92, achieved: false },
      { exerciseName: 'Squat', targetWeight: 140, targetReps: 5, progressPct: 40, achieved: false },
    ],
    fatigue: { stalledExercises: ['Row'], deloadRecommended: false, deloadReasons: [], deloadActive: false },
    conditioning: {
      weekCurrent: { minutes: 45, km: 5, sessions: 1 },
      weekPrevious: null,
      days: [],
      weeklyTargetMin: 150,
    },
    records: [{ exerciseName: 'Bench press', maxWeight: 90, maxWeightReps: 5, bestE1RM: 104.9 }],
    recentProgress: [],
  } as unknown as CoachPayload;
}

describe('compactDailyTipSnapshot', () => {
  it('summarizes the week and orders recent sessions newest first', () => {
    const snap = compactDailyTipSnapshot(payloadFixture(), '2026-09-08', 2);
    expect(snap.today).toBe('2026-09-08');
    expect(snap.weekday).toBe('Tuesday');
    expect(snap.thisWeek).toEqual({ sessions: 2, totalVolume: 9001, workouts: ['Push', 'Pull'] });
    expect(snap.lastWeek).toEqual({ sessions: 1, totalVolume: 6000 });
    expect(snap.recentSessions.map((s) => s.workoutName)).toEqual(['Pull', 'Push']);
    expect(snap.recentSessions[0]?.topLifts[0]).toEqual({ exercise: 'Squat', bestE1RM: 140 });
  });

  it("picks today's planned workout from the program by ISO weekday", () => {
    expect(compactDailyTipSnapshot(payloadFixture(), '2026-09-08', 2).activeProgram).toEqual({
      name: 'PPL',
      todaysWorkout: 'Pull',
    });
    // Sunday: JS getDay 0 maps to Prisma dayOfWeek 7.
    expect(compactDailyTipSnapshot(payloadFixture(), '2026-09-13', 0).activeProgram?.todaysWorkout).toBe(
      'Legs',
    );
    // Wednesday: nothing planned.
    expect(compactDailyTipSnapshot(payloadFixture(), '2026-09-09', 3).activeProgram?.todaysWorkout).toBe(
      null,
    );
  });

  it('keeps only goals that are close and rounds records', () => {
    const snap = compactDailyTipSnapshot(payloadFixture(), '2026-09-08', 2);
    expect(snap.goalsClose).toEqual([{ exercise: 'Bench press', progressPct: 92 }]);
    expect(snap.records).toEqual([{ exercise: 'Bench press', maxWeight: 90, reps: 5, bestE1RM: 105 }]);
    expect(snap.fatigue).toEqual({ stalled: ['Row'], deloadRecommended: false, deloadActive: false });
    expect(snap.latestReadiness).toEqual({ daysAgo: 0, readiness: 4, sleepQuality: 3, note: 'slept late' });
    expect(snap.conditioning).toEqual({ minutesThisWeek: 45, targetMinutes: 150 });
  });
});
