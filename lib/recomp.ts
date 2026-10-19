// ============================================================
// Recomp monitor: strength retention + body trend while cutting
// ============================================================
// Pure, deterministic signals for a fat-loss / recomposition block. Nothing
// here estimates body fat, calories or recovery: it compares logged numbers
// (top-set e1RM, bodyweight entries, waist measurements) and reports what they
// show, plus rule-based HYPOTHESES the UI must present as such.

const DAY_MS = 24 * 60 * 60 * 1000;

// Baseline strength = best e1RM in the two weeks either side of the block
// start (so pre-cut lifting counts); recent = best e1RM of the last two weeks.
export const RETENTION_WINDOW_DAYS = 14;
// e1RM change bands. Day-to-day e1RM noise is a few percent, so only a drop
// beyond 5% is worth watching and beyond 10% reads as a real decline.
export const RETENTION_WATCH_BELOW_PCT = -5;
export const RETENTION_DECLINE_BELOW_PCT = -10;
// "Strength anchor" = a compound the program trains heavy (top of range <= 6).
export const ANCHOR_MAX_REPS = 6;
// Bodyweight trend: least-squares slope over this many days, needing at least
// MIN entries spanning at least MIN_SPAN days to be reported.
export const BODYWEIGHT_TREND_DAYS = 28;
export const BODYWEIGHT_TREND_MIN_ENTRIES = 3;
export const BODYWEIGHT_TREND_MIN_SPAN_DAYS = 7;
// Losing faster than 1% of bodyweight per week raises the risk of losing
// muscle; slower than 0.1%/week for 3+ weeks reads as "not losing".
export const FAST_LOSS_PCT_PER_WEEK = 1;
export const STALLED_LOSS_PCT_PER_WEEK = 0.1;
export const STALLED_MIN_SPAN_DAYS = 21;

export type RetentionStatus = 'maintained' | 'watch' | 'declining' | 'insufficient';

export interface E1rmPoint {
  date: Date;
  e1RM: number;
}

export interface AnchorInput {
  exerciseName: string;
  points: E1rmPoint[];
}

export interface AnchorRetention {
  exerciseName: string;
  status: RetentionStatus;
  baselineE1RM: number | null;
  recentE1RM: number | null;
  // (recent - baseline) / baseline in percent, one decimal. Null when
  // insufficient.
  changePct: number | null;
}

export interface RetentionOptions {
  // Start of the block. Null = no block: the baseline falls back to the
  // oldest two weeks of `windowStart`.
  blockStart: Date | null;
  windowStart: Date;
  now: Date;
  // Dates to ignore (e.g. sessions inside a scheduled deload week, where the
  // load is lowered on purpose and would read as a strength drop).
  isExcluded?: (date: Date) => boolean;
}

function bestIn(points: E1rmPoint[], from: number, to: number): number | null {
  let best: number | null = null;
  for (const p of points) {
    const t = p.date.getTime();
    if (t < from || t >= to || p.e1RM <= 0) continue;
    if (best === null || p.e1RM > best) best = p.e1RM;
  }
  return best;
}

export function anchorRetention(anchor: AnchorInput, opts: RetentionOptions): AnchorRetention {
  const points = opts.isExcluded
    ? anchor.points.filter((p) => !opts.isExcluded!(p.date))
    : anchor.points;
  const span = RETENTION_WINDOW_DAYS * DAY_MS;
  const baselineFrom = opts.blockStart
    ? opts.blockStart.getTime() - span
    : opts.windowStart.getTime();
  const baselineTo = opts.blockStart ? opts.blockStart.getTime() + span : baselineFrom + span;
  const recentFrom = opts.now.getTime() - span;
  const recentTo = opts.now.getTime() + 1;

  const insufficient: AnchorRetention = {
    exerciseName: anchor.exerciseName,
    status: 'insufficient',
    baselineE1RM: null,
    recentE1RM: null,
    changePct: null,
  };
  // The two windows must not overlap, or "recent" just re-reads the baseline.
  if (recentFrom < baselineTo) {
    return { ...insufficient, baselineE1RM: bestIn(points, baselineFrom, baselineTo) };
  }
  const baseline = bestIn(points, baselineFrom, baselineTo);
  const recent = bestIn(points, recentFrom, recentTo);
  if (baseline === null || recent === null) {
    return { ...insufficient, baselineE1RM: baseline, recentE1RM: recent };
  }
  const changePct = +(((recent - baseline) / baseline) * 100).toFixed(1);
  const status: RetentionStatus =
    changePct < RETENTION_DECLINE_BELOW_PCT
      ? 'declining'
      : changePct < RETENTION_WATCH_BELOW_PCT
        ? 'watch'
        : 'maintained';
  return {
    exerciseName: anchor.exerciseName,
    status,
    baselineE1RM: +baseline.toFixed(1),
    recentE1RM: +recent.toFixed(1),
    changePct,
  };
}

export interface BodyweightTrend {
  // Slope in kg per week (negative = losing).
  kgPerWeek: number;
  // Slope as a percent of the mean bodyweight per week.
  pctPerWeek: number;
  spanDays: number;
  entries: number;
}

// Least-squares bodyweight slope over the last BODYWEIGHT_TREND_DAYS. Null
// when there are too few entries or they span too few days.
export function bodyweightTrend(
  entries: { weightKg: number; measuredAt: Date }[],
  now: Date,
): BodyweightTrend | null {
  const from = now.getTime() - BODYWEIGHT_TREND_DAYS * DAY_MS;
  const pts = entries
    .filter((e) => e.measuredAt.getTime() >= from && e.measuredAt.getTime() <= now.getTime())
    .map((e) => ({ x: e.measuredAt.getTime() / DAY_MS, y: e.weightKg }));
  if (pts.length < BODYWEIGHT_TREND_MIN_ENTRIES) return null;
  const xs = pts.map((p) => p.x);
  const spanDays = Math.max(...xs) - Math.min(...xs);
  if (spanDays < BODYWEIGHT_TREND_MIN_SPAN_DAYS) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / pts.length;
  const my = pts.reduce((a, p) => a + p.y, 0) / pts.length;
  let num = 0;
  let den = 0;
  for (const p of pts) {
    num += (p.x - mx) * (p.y - my);
    den += (p.x - mx) ** 2;
  }
  const perDay = den === 0 ? 0 : num / den;
  const kgPerWeek = perDay * 7;
  return {
    kgPerWeek: +kgPerWeek.toFixed(2),
    pctPerWeek: +((kgPerWeek / my) * 100).toFixed(2),
    spanDays: Math.round(spanDays),
    entries: pts.length,
  };
}

export interface WaistChange {
  firstCm: number;
  latestCm: number;
  deltaCm: number;
  spanDays: number;
}

// Waist change from the first measurement on/after `since` to the latest.
export function waistChange(
  entries: { valueCm: number; measuredAt: Date }[],
  since: Date,
): WaistChange | null {
  const pts = entries
    .filter((e) => e.measuredAt.getTime() >= since.getTime())
    .sort((a, b) => a.measuredAt.getTime() - b.measuredAt.getTime());
  const first = pts[0];
  const latest = pts[pts.length - 1];
  if (!first || !latest || pts.length < 2) return null;
  return {
    firstCm: first.valueCm,
    latestCm: latest.valueCm,
    deltaCm: +(latest.valueCm - first.valueCm).toFixed(1),
    spanDays: Math.round((latest.measuredAt.getTime() - first.measuredAt.getTime()) / DAY_MS),
  };
}

// Rule-based hypotheses. They are prompts to look closer, never diagnoses.
export type RecompSignal =
  | 'strength-drop-with-fast-loss'
  | 'strength-drop'
  | 'fast-loss'
  | 'not-losing'
  | 'on-track'
  | 'need-data';

export function recompSignals(input: {
  anchors: AnchorRetention[];
  bodyweight: BodyweightTrend | null;
  waist: WaistChange | null;
}): RecompSignal[] {
  const judged = input.anchors.filter((a) => a.status !== 'insufficient');
  const declining = judged.filter((a) => a.status === 'declining').length;
  const fastLoss =
    input.bodyweight != null && input.bodyweight.pctPerWeek < -FAST_LOSS_PCT_PER_WEEK;
  const notLosing =
    input.bodyweight != null &&
    input.bodyweight.spanDays >= STALLED_MIN_SPAN_DAYS &&
    input.bodyweight.pctPerWeek > -STALLED_LOSS_PCT_PER_WEEK &&
    (input.waist == null || input.waist.deltaCm >= 0);

  const signals: RecompSignal[] = [];
  if (declining > 0 && fastLoss) signals.push('strength-drop-with-fast-loss');
  else if (declining > 0) signals.push('strength-drop');
  else if (fastLoss) signals.push('fast-loss');
  if (notLosing) signals.push('not-losing');

  const losing =
    (input.bodyweight != null && input.bodyweight.pctPerWeek <= -STALLED_LOSS_PCT_PER_WEEK) ||
    (input.waist != null && input.waist.deltaCm < 0);
  if (signals.length === 0 && judged.length > 0 && losing) signals.push('on-track');
  if (signals.length === 0) signals.push('need-data');
  return signals;
}
