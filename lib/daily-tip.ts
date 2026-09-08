import { db } from '@/lib/db';
import { buildCoachPayload, type CoachPayload } from '@/lib/coach';
import { getLlmProvider } from '@/lib/llm';
import { buildDailyTipSystemPrompt } from '@/lib/prompts/daily-tip-prompt';
import type { Locale } from '@/i18n/config';

// ============================================================
// "Today's one-liner" from the coach (home page card)
// ============================================================
// The snapshot is a trimmed-down view of the weekly-debrief payload: the same
// server-side derivations (records, stalls, deload, readiness, conditioning)
// without per-set rows, so a short greeting costs a few hundred input tokens
// rather than several thousand.

export interface DailyTipSnapshot {
  today: string; // YYYY-MM-DD, the lifter's local day
  weekday: string; // e.g. "Monday"
  profile: {
    displayName: string | null;
    goal: string | null;
    weeklyFrequency: number | null;
    coachNote: string | null;
  };
  thisWeek: {
    sessions: number;
    totalVolume: number;
    workouts: string[]; // workout names trained this week, in order
  };
  lastWeek: { sessions: number; totalVolume: number } | null;
  recentSessions: Array<{
    date: string;
    workoutName: string | null;
    workingSets: number;
    totalVolume: number;
    topLifts: Array<{ exercise: string; bestE1RM: number }>;
  }>;
  activeProgram: { name: string; todaysWorkout: string | null } | null;
  latestReadiness: {
    daysAgo: number;
    readiness: number;
    sleepQuality: number;
    note: string | null;
  } | null;
  records: Array<{ exercise: string; maxWeight: number; reps: number; bestE1RM: number }>;
  fatigue: { stalled: string[]; deloadRecommended: boolean; deloadActive: boolean };
  goalsClose: Array<{ exercise: string; progressPct: number }>;
  conditioning: { minutesThisWeek: number; targetMinutes: number };
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Pure: trims the full coach payload down to what a one-liner needs.
export function compactDailyTipSnapshot(
  payload: CoachPayload,
  day: string,
  weekdayIndex: number,
): DailyTipSnapshot {
  const week = payload.weekCurrent;
  const recent = [...week.sessions]
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, 3)
    .map((s) => ({
      date: s.startedAt.slice(0, 10),
      workoutName: s.workoutName,
      workingSets: s.workingSetCount,
      totalVolume: Math.round(s.totalVolume),
      topLifts: [...s.exercises]
        .sort((a, b) => b.bestE1RM - a.bestE1RM)
        .slice(0, 3)
        .map((e) => ({ exercise: e.exerciseName, bestE1RM: Math.round(e.bestE1RM) })),
    }));

  const program = payload.activeProgram;
  // Prisma stores dayOfWeek as 1 (Monday) .. 7 (Sunday); JS getDay is 0=Sunday.
  const isoWeekday = weekdayIndex === 0 ? 7 : weekdayIndex;
  const todaysWorkout =
    program?.workouts.find((w) => w.dayOfWeek === isoWeekday)?.name ?? null;

  return {
    today: day,
    weekday: WEEKDAYS[weekdayIndex] ?? 'Monday',
    profile: {
      displayName: payload.userProfile.displayName,
      goal: payload.userProfile.goal,
      weeklyFrequency: payload.userProfile.weeklyFrequency,
      coachNote: payload.userProfile.coachNote,
    },
    thisWeek: {
      sessions: week.sessions.length,
      totalVolume: Math.round(week.sessions.reduce((sum, s) => sum + s.totalVolume, 0)),
      workouts: week.sessions.map((s) => s.workoutName).filter((n): n is string => n != null),
    },
    lastWeek: payload.weekPrevious
      ? {
          sessions: payload.weekPrevious.sessions.length,
          totalVolume: Math.round(
            payload.weekPrevious.sessions.reduce((sum, s) => sum + s.totalVolume, 0),
          ),
        }
      : null,
    recentSessions: recent,
    activeProgram: program ? { name: program.name, todaysWorkout } : null,
    latestReadiness: payload.latestReadiness
      ? {
          daysAgo: payload.latestReadiness.daysAgo,
          readiness: payload.latestReadiness.readiness,
          sleepQuality: payload.latestReadiness.sleepQuality,
          note: payload.latestReadiness.note,
        }
      : null,
    records: payload.records.slice(0, 6).map((r) => ({
      exercise: r.exerciseName,
      maxWeight: r.maxWeight,
      reps: r.maxWeightReps,
      bestE1RM: Math.round(r.bestE1RM),
    })),
    fatigue: {
      stalled: payload.fatigue.stalledExercises,
      deloadRecommended: payload.fatigue.deloadRecommended,
      deloadActive: payload.fatigue.deloadActive,
    },
    goalsClose: payload.goals
      .filter((g) => !g.achieved && g.progressPct >= 80)
      .map((g) => ({ exercise: g.exerciseName, progressPct: g.progressPct })),
    conditioning: {
      minutesThisWeek: payload.conditioning.weekCurrent.minutes,
      targetMinutes: payload.conditioning.weeklyTargetMin,
    },
  };
}

export const DAILY_TIP_MAX_CHARS = 200;

// Pure: makes the model output safe to render as a single line. Keeps the first
// non-empty line, strips wrapping quotes and markdown emphasis, caps length.
export function sanitizeDailyTip(raw: string): string {
  const firstLine =
    raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l.length > 0) ?? '';
  let text = firstLine
    .replace(/^[-*•\d.)\s]+/, '')
    .replace(/^["'“”「『]+|["'“”」』]+$/g, '')
    .replace(/\*\*|__|`/g, '')
    .trim();
  if (text.length > DAILY_TIP_MAX_CHARS) {
    text = `${text.slice(0, DAILY_TIP_MAX_CHARS - 1).trimEnd()}…`;
  }
  return text;
}

export interface DailyTip {
  text: string;
  day: string;
  locale: Locale;
  modelUsed: string;
  generatedAt: string;
}

// Server-side: returns today's cached tip, or generates and stores one.
// `force` regenerates even when a row exists (the card's refresh button).
export async function getDailyTip(
  userId: string,
  day: string,
  locale: Locale,
  opts: { force?: boolean } = {},
): Promise<DailyTip> {
  if (!opts.force) {
    const cached = await db.dailyTip.findUnique({
      where: { userId_day_locale: { userId, day, locale } },
    });
    if (cached) {
      return {
        text: cached.text,
        day,
        locale,
        modelUsed: cached.modelUsed,
        generatedAt: cached.updatedAt.toISOString(),
      };
    }
  }

  const payload = await buildCoachPayload(userId);
  const weekdayIndex = new Date(`${day}T12:00:00Z`).getUTCDay();
  const snapshot = compactDailyTipSnapshot(payload, day, weekdayIndex);

  const provider = getLlmProvider();
  const { text: raw, modelUsed } = await provider.complete({
    system: buildDailyTipSystemPrompt(locale),
    messages: [{ role: 'user', content: JSON.stringify(snapshot) }],
    temperature: 0.9,
    maxTokens: 200,
  });
  const text = sanitizeDailyTip(raw);

  const stored = await db.dailyTip.upsert({
    where: { userId_day_locale: { userId, day, locale } },
    create: { userId, day, locale, text, modelUsed },
    update: { text, modelUsed },
  });

  return { text, day, locale, modelUsed, generatedAt: stored.updatedAt.toISOString() };
}
