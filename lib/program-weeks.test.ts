import { describe, expect, it } from 'vitest';
import {
  isPlannedDeloadNow,
  plannedDeloadEnd,
  programWeek,
  programWeekInfo,
  type ProgramSchedule,
} from './program-weeks';

// 2026-10-19 is a Monday.
const start = new Date('2026-10-19T12:00:00Z');
const recomp: ProgramSchedule = { startDate: start, durationWeeks: 12, deloadWeeks: [4, 8] };
const day = (iso: string) => new Date(`${iso}T12:00:00Z`);

describe('programWeek', () => {
  it('counts the start week as week 1 through its Sunday', () => {
    expect(programWeek(start, day('2026-10-19'))).toBe(1);
    expect(programWeek(start, day('2026-10-25'))).toBe(1);
  });

  it('flips to the next week on Monday', () => {
    expect(programWeek(start, day('2026-10-26'))).toBe(2);
    expect(programWeek(start, day('2026-11-09'))).toBe(4);
  });

  it('counts a mid-week start as week 1', () => {
    const thursday = day('2026-10-22');
    expect(programWeek(thursday, day('2026-10-25'))).toBe(1);
    expect(programWeek(thursday, day('2026-10-26'))).toBe(2);
  });

  it('never returns less than 1 before the start date', () => {
    expect(programWeek(start, day('2026-10-01'))).toBe(1);
  });

  it('counts across a year boundary', () => {
    const s = day('2026-12-28');
    expect(programWeek(s, day('2027-01-04'))).toBe(2);
  });
});

describe('programWeekInfo', () => {
  it('is null for an open-ended program', () => {
    expect(programWeekInfo({ ...recomp, durationWeeks: null }, day('2026-10-20'))).toBeNull();
    expect(programWeekInfo(null, day('2026-10-20'))).toBeNull();
  });

  it('flags weeks 4 and 8 as deload weeks', () => {
    const weeks = Array.from({ length: 12 }, (_, i) => {
      const now = new Date(start.getTime() + i * 7 * 86400000);
      return programWeekInfo(recomp, now)!;
    });
    expect(weeks.map((w) => w.week)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(weeks.filter((w) => w.isDeloadWeek).map((w) => w.week)).toEqual([4, 8]);
    expect(weeks.every((w) => !w.finished && w.totalWeeks === 12)).toBe(true);
  });

  it('reports finished after the planned length and stops deloading', () => {
    const info = programWeekInfo({ ...recomp, deloadWeeks: [13] }, day('2027-01-11'))!;
    expect(info.week).toBe(13);
    expect(info.finished).toBe(true);
    expect(info.isDeloadWeek).toBe(false);
  });

  it('ends the week on the next Monday 00:00 UTC', () => {
    expect(programWeekInfo(recomp, day('2026-11-11'))!.weekEnd.toISOString()).toBe(
      '2026-11-16T00:00:00.000Z',
    );
  });
});

describe('isPlannedDeloadNow / plannedDeloadEnd', () => {
  const week4 = day('2026-11-11');
  const week5 = day('2026-11-18');

  it('is active during a scheduled deload week', () => {
    expect(isPlannedDeloadNow(null, recomp, week4)).toBe(true);
    expect(plannedDeloadEnd(null, recomp, week4)?.toISOString()).toBe('2026-11-16T00:00:00.000Z');
  });

  it('is inactive outside deload weeks with no manual deload', () => {
    expect(isPlannedDeloadNow(null, recomp, week5)).toBe(false);
    expect(plannedDeloadEnd(null, recomp, week5)).toBeNull();
  });

  it('keeps honoring the one-tap deload (User.deloadUntil)', () => {
    const until = new Date(week5.getTime() + 86400000);
    expect(isPlannedDeloadNow(until, null, week5)).toBe(true);
    expect(isPlannedDeloadNow(until, recomp, week5)).toBe(true);
    expect(plannedDeloadEnd(until, recomp, week5)).toEqual(until);
  });

  it('ignores an expired manual deload', () => {
    const past = new Date(week5.getTime() - 1000);
    expect(isPlannedDeloadNow(past, null, week5)).toBe(false);
  });

  it('reports the later end when both overlap', () => {
    const until = new Date('2026-11-20T00:00:00Z');
    expect(plannedDeloadEnd(until, recomp, week4)).toEqual(until);
  });
});
