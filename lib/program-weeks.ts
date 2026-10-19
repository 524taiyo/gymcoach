import { isDeloadActive } from './deload';
import { isoWeekStart } from './stats';

// ============================================================
// Program block schedule (12-week recomp)
// ============================================================
// A program may carry a planned length (durationWeeks) and planned deload
// weeks (deloadWeeks, 1-based). The current block week is derived from the
// clock, never stored: week 1 is the ISO week (Monday start, UTC) that
// contains Program.startDate, so a program started mid-week counts that week
// as week 1 and every later week flips on Monday. Pure: callers pass `now`.

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface ProgramSchedule {
  startDate: Date;
  durationWeeks: number | null;
  deloadWeeks: readonly number[];
}

export interface ProgramWeekInfo {
  // 1-based current block week. Can exceed `totalWeeks` once the block is over.
  week: number;
  totalWeeks: number;
  // True when the current week is a planned deload week.
  isDeloadWeek: boolean;
  // True once the planned block length has elapsed.
  finished: boolean;
  // Exclusive end of the current week (next Monday 00:00 UTC).
  weekEnd: Date;
}

// 1-based block week for `now`. Weeks before the start read as week 1.
export function programWeek(startDate: Date, now: Date): number {
  const diff = isoWeekStart(now).getTime() - isoWeekStart(startDate).getTime();
  return Math.max(1, Math.round(diff / WEEK_MS) + 1);
}

// Week counter for a program with a planned length; null for open-ended ones.
export function programWeekInfo(
  schedule: ProgramSchedule | null | undefined,
  now: Date,
): ProgramWeekInfo | null {
  if (!schedule || schedule.durationWeeks == null) return null;
  const week = programWeek(schedule.startDate, now);
  const weekEnd = new Date(isoWeekStart(now).getTime() + WEEK_MS);
  const finished = week > schedule.durationWeeks;
  return {
    week,
    totalWeeks: schedule.durationWeeks,
    isDeloadWeek: !finished && schedule.deloadWeeks.includes(week),
    finished,
    weekEnd,
  };
}

// Whether load suggestions should apply the planned-deload step-down: either
// the one-tap deload (User.deloadUntil) is running, or the active program has
// a scheduled deload this week.
export function isPlannedDeloadNow(
  deloadUntil: Date | null,
  schedule: ProgramSchedule | null | undefined,
  now: Date,
): boolean {
  return isDeloadActive(deloadUntil, now) || (programWeekInfo(schedule, now)?.isDeloadWeek ?? false);
}

// End of whichever planned deload is running now (the later of the two), or
// null when none is. Lets the deload banner show one end date.
export function plannedDeloadEnd(
  deloadUntil: Date | null,
  schedule: ProgramSchedule | null | undefined,
  now: Date,
): Date | null {
  const manual = isDeloadActive(deloadUntil, now) ? deloadUntil : null;
  const info = programWeekInfo(schedule, now);
  const scheduled = info?.isDeloadWeek ? info.weekEnd : null;
  if (manual && scheduled) return manual > scheduled ? manual : scheduled;
  return manual ?? scheduled;
}
