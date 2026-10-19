import { describe, expect, it, vi } from 'vitest';

// The module also exports a DB-backed fetcher; the pure assembly under test
// never touches it.
vi.mock('@/lib/db', () => ({ db: {} }));

import { assembleRecompSummary, type RecompSummaryInput } from './recomp-summary';

const day = (iso: string) => new Date(`${iso}T12:00:00Z`);

const bench = {
  id: 'bench',
  name: 'Bench Press',
  muscleGroup: 'CHEST',
  category: 'COMPOUND',
  usesBodyweight: false,
};
const fly = {
  id: 'fly',
  name: 'Cable Fly',
  muscleGroup: 'CHEST',
  category: 'ISOLATION',
  usesBodyweight: false,
};

function set(exerciseId: string, iso: string, weight: number, reps: number) {
  return {
    exerciseId,
    muscleGroup: 'CHEST',
    usesBodyweight: false,
    weight,
    reps,
    isWarmup: false,
    durationSec: null,
    sessionId: `${exerciseId}-${iso}`,
    sessionStartedAt: day(iso),
  };
}

const base: RecompSummaryInput = {
  now: day('2026-12-16'),
  schedule: { startDate: day('2026-10-19'), durationWeeks: 12, deloadWeeks: [4, 8] },
  programExercises: [
    { targetSets: 4, targetRepsMax: 6, exercise: bench },
    { targetSets: 3, targetRepsMax: 15, exercise: fly },
  ],
  sets: [
    set('bench', '2026-10-19', 80, 4),
    set('bench', '2026-12-07', 60, 4), // week 8 deload, excluded
    set('bench', '2026-12-14', 80, 3),
    set('fly', '2026-12-14', 20, 12),
  ],
  bodyweight: 110,
  bodyweightEntries: [
    { weightKg: 110, measuredAt: day('2026-11-20') },
    { weightKg: 109.4, measuredAt: day('2026-11-27') },
    { weightKg: 108.8, measuredAt: day('2026-12-04') },
    { weightKg: 108.2, measuredAt: day('2026-12-11') },
  ],
  waistEntries: [
    { valueCm: 104, measuredAt: day('2026-10-19') },
    { valueCm: 101, measuredAt: day('2026-12-14') },
  ],
  volumeTargets: {},
};

describe('assembleRecompSummary', () => {
  it('only treats heavy program compounds as strength anchors', () => {
    const summary = assembleRecompSummary(base);
    expect(summary.strengthRetention.map((a) => a.exerciseName)).toEqual(['Bench Press']);
  });

  it('measures retention around the block start and skips scheduled deload weeks', () => {
    const [bench] = assembleRecompSummary(base).strengthRetention;
    // 80 x 4 -> 90.7, 80 x 3 -> 88; the 60 kg deload session is ignored.
    expect(bench).toMatchObject({ status: 'maintained', baselineE1RM: 90.7, recentE1RM: 88 });
  });

  it('carries the body trend, waist change and an on-track signal', () => {
    const summary = assembleRecompSummary(base);
    expect(summary.bodyweightTrend?.kgPerWeek).toBeCloseTo(-0.6, 2);
    expect(summary.waistChange?.deltaCm).toBe(-3);
    expect(summary.signals).toEqual(['on-track']);
  });

  it('reports planned vs logged weekly sets per muscle', () => {
    const [chest] = assembleRecompSummary(base).weeklySets;
    expect(chest).toEqual({
      group: 'CHEST',
      planned: 7,
      thisWeek: 2,
      lastWeek: 1,
      mev: 10,
      mrv: 20,
    });
  });
});
