import { describe, expect, it } from 'vitest';
import {
  anchorRetention,
  bodyweightTrend,
  recompSignals,
  waistChange,
  type AnchorRetention,
} from './recomp';

const day = (iso: string) => new Date(`${iso}T12:00:00Z`);
const blockStart = day('2026-10-19');
const windowStart = day('2026-07-27');

function bench(points: [string, number][]) {
  return {
    exerciseName: 'Bench Press',
    points: points.map(([d, e]) => ({ date: day(d), e1RM: e })),
  };
}

describe('anchorRetention', () => {
  const opts = { blockStart, windowStart, now: day('2026-12-14') };

  it('reports maintained when the recent best is within 5%', () => {
    const r = anchorRetention(
      bench([
        ['2026-10-12', 100],
        ['2026-10-26', 98],
        ['2026-12-07', 97],
      ]),
      opts,
    );
    expect(r).toMatchObject({
      status: 'maintained',
      baselineE1RM: 100,
      recentE1RM: 97,
      changePct: -3,
    });
  });

  it('counts pre-block lifting in the baseline', () => {
    const r = anchorRetention(
      bench([
        ['2026-10-08', 110],
        ['2026-12-10', 100],
      ]),
      opts,
    );
    expect(r.baselineE1RM).toBe(110);
    expect(r.status).toBe('watch');
  });

  it('reports declining beyond -10%', () => {
    const r = anchorRetention(
      bench([
        ['2026-10-20', 100],
        ['2026-12-10', 88],
      ]),
      opts,
    );
    expect(r).toMatchObject({ status: 'declining', changePct: -12 });
  });

  it('is insufficient while the recent window overlaps the baseline', () => {
    const r = anchorRetention(bench([['2026-10-20', 100]]), { ...opts, now: day('2026-10-28') });
    expect(r.status).toBe('insufficient');
    expect(r.baselineE1RM).toBe(100);
  });

  it('is insufficient without recent sessions', () => {
    const r = anchorRetention(bench([['2026-10-20', 100]]), opts);
    expect(r.status).toBe('insufficient');
  });

  it('ignores excluded (deload) dates', () => {
    const r = anchorRetention(
      bench([
        ['2026-10-20', 100],
        ['2026-12-08', 85],
        ['2026-12-01', 99],
      ]),
      {
        ...opts,
        now: day('2026-12-10'),
        isExcluded: (d) => d.getTime() === day('2026-12-08').getTime(),
      },
    );
    expect(r).toMatchObject({ status: 'maintained', recentE1RM: 99 });
  });

  it('uses the oldest two weeks of the window when there is no block', () => {
    const r = anchorRetention(
      bench([
        ['2026-07-30', 100],
        ['2026-10-10', 120],
        ['2026-10-15', 101],
      ]),
      {
        blockStart: null,
        windowStart,
        now: day('2026-10-19'),
      },
    );
    expect(r).toMatchObject({ baselineE1RM: 100, recentE1RM: 120, status: 'maintained' });
  });
});

describe('bodyweightTrend', () => {
  const now = day('2026-11-16');

  it('fits a weekly slope over the last 28 days', () => {
    const entries = [0, 7, 14, 21].map((d, i) => ({
      weightKg: 110 - i * 0.7,
      measuredAt: new Date(day('2026-10-19').getTime() + d * 86400000),
    }));
    const t = bodyweightTrend(entries, now)!;
    expect(t.kgPerWeek).toBeCloseTo(-0.7, 2);
    expect(t.pctPerWeek).toBeCloseTo(-0.65, 1);
    expect(t.entries).toBe(4);
    expect(t.spanDays).toBe(21);
  });

  it('needs at least 3 entries over at least 7 days', () => {
    expect(
      bodyweightTrend(
        [
          { weightKg: 110, measuredAt: day('2026-11-10') },
          { weightKg: 109, measuredAt: day('2026-11-15') },
        ],
        now,
      ),
    ).toBeNull();
    expect(
      bodyweightTrend(
        [
          { weightKg: 110, measuredAt: day('2026-11-12') },
          { weightKg: 109.8, measuredAt: day('2026-11-13') },
          { weightKg: 109.6, measuredAt: day('2026-11-14') },
        ],
        now,
      ),
    ).toBeNull();
  });

  it('ignores entries older than 28 days', () => {
    const t = bodyweightTrend(
      [
        { weightKg: 130, measuredAt: day('2026-09-01') },
        { weightKg: 110, measuredAt: day('2026-11-01') },
        { weightKg: 110, measuredAt: day('2026-11-08') },
        { weightKg: 110, measuredAt: day('2026-11-15') },
      ],
      now,
    )!;
    expect(t.kgPerWeek).toBe(0);
  });
});

describe('waistChange', () => {
  it('compares the first measurement since the start with the latest', () => {
    const w = waistChange(
      [
        { valueCm: 105, measuredAt: day('2026-10-01') },
        { valueCm: 104, measuredAt: day('2026-10-19') },
        { valueCm: 101.5, measuredAt: day('2026-11-16') },
      ],
      blockStart,
    );
    expect(w).toEqual({ firstCm: 104, latestCm: 101.5, deltaCm: -2.5, spanDays: 28 });
  });

  it('needs two measurements', () => {
    expect(waistChange([{ valueCm: 104, measuredAt: day('2026-10-20') }], blockStart)).toBeNull();
  });
});

describe('recompSignals', () => {
  const anchor = (status: AnchorRetention['status']): AnchorRetention => ({
    exerciseName: 'Bench Press',
    status,
    baselineE1RM: 100,
    recentE1RM: 100,
    changePct: 0,
  });
  const trend = (pctPerWeek: number, spanDays = 28) => ({
    kgPerWeek: pctPerWeek * 1.1,
    pctPerWeek,
    spanDays,
    entries: 5,
  });
  const waist = (deltaCm: number) => ({
    firstCm: 104,
    latestCm: 104 + deltaCm,
    deltaCm,
    spanDays: 28,
  });

  it('is on track when strength holds and waist or weight goes down', () => {
    expect(
      recompSignals({ anchors: [anchor('maintained')], bodyweight: trend(-0.6), waist: waist(-2) }),
    ).toEqual(['on-track']);
  });

  it('flags a strength drop combined with fast loss', () => {
    expect(
      recompSignals({ anchors: [anchor('declining')], bodyweight: trend(-1.3), waist: null }),
    ).toEqual(['strength-drop-with-fast-loss']);
  });

  it('flags a strength drop alone', () => {
    expect(
      recompSignals({ anchors: [anchor('declining')], bodyweight: trend(-0.5), waist: null }),
    ).toEqual(['strength-drop']);
  });

  it('flags fast loss even while strength holds', () => {
    expect(
      recompSignals({ anchors: [anchor('maintained')], bodyweight: trend(-1.4), waist: null }),
    ).toEqual(['fast-loss']);
  });

  it('flags not losing after 3 weeks of flat weight and waist', () => {
    expect(
      recompSignals({ anchors: [anchor('maintained')], bodyweight: trend(0, 21), waist: waist(0) }),
    ).toEqual(['not-losing']);
  });

  it('does not call a flat weight "not losing" while the waist shrinks', () => {
    expect(
      recompSignals({
        anchors: [anchor('maintained')],
        bodyweight: trend(0, 28),
        waist: waist(-1.5),
      }),
    ).toEqual(['on-track']);
  });

  it('asks for data when nothing can be judged', () => {
    expect(
      recompSignals({ anchors: [anchor('insufficient')], bodyweight: null, waist: null }),
    ).toEqual(['need-data']);
  });
});
