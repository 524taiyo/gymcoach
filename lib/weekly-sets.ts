import { classifyWeeklySets, resolveVolumeBand, type VolumeLandmarkZone } from './stats';

// ============================================================
// Weekly hard sets per muscle group: plan vs done
// ============================================================
// Counts the working sets the active program plans per primary muscle group
// per week, next to what was actually logged this week and last week, each
// classified against the muscle's MEV/MRV band (personal VolumeTarget or the
// defaults). Primary muscle only, matching weeklySetsByMuscleGroup. Pure.

export interface PlannedExercise {
  muscleGroup: string;
  category: string;
  targetSets: number;
}

// Program sets per muscle group per week. Every workout is assumed to run
// once a week (the program is a weekly split). Cardio is skipped.
export function plannedWeeklySets(
  workouts: readonly { exercises: readonly PlannedExercise[] }[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const w of workouts) {
    for (const e of w.exercises) {
      if (e.category === 'CARDIO') continue;
      out[e.muscleGroup] = (out[e.muscleGroup] ?? 0) + e.targetSets;
    }
  }
  return out;
}

export interface WeeklySetsRow {
  group: string;
  planned: number;
  thisWeek: number;
  lastWeek: number;
  mev: number;
  mrv: number;
  custom: boolean;
  // Plan judged against the band (what the program aims for).
  plannedZone: VolumeLandmarkZone;
  // Last full week judged against the band (what was actually done).
  lastWeekZone: VolumeLandmarkZone;
}

// One row per muscle group that is planned or was trained in either week,
// sorted by planned sets (desc), then name.
export function weeklySetsRows(input: {
  planned: Record<string, number>;
  thisWeek: Record<string, number>;
  lastWeek: Record<string, number>;
  targets?: Record<string, { mev: number; mrv: number }>;
}): WeeklySetsRow[] {
  const groups = new Set([
    ...Object.keys(input.planned),
    ...Object.keys(input.thisWeek),
    ...Object.keys(input.lastWeek),
  ]);
  groups.delete('OTHER');
  return [...groups]
    .map((group) => {
      const band = resolveVolumeBand(group, input.targets);
      const planned = input.planned[group] ?? 0;
      const lastWeek = input.lastWeek[group] ?? 0;
      return {
        group,
        planned,
        thisWeek: input.thisWeek[group] ?? 0,
        lastWeek,
        mev: band.mev,
        mrv: band.mrv,
        custom: band.custom,
        plannedZone: classifyWeeklySets(planned, band.mev, band.mrv),
        lastWeekZone: classifyWeeklySets(lastWeek, band.mev, band.mrv),
      };
    })
    .sort((a, b) => b.planned - a.planned || a.group.localeCompare(b.group));
}
