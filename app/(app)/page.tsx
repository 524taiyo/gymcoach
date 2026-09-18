import Link from 'next/link';
import { DailyTipCard } from '@/components/dashboard/daily-tip-card';
import { RecentSessions } from '@/components/dashboard/recent-sessions';
import { TodayWorkoutCard } from '@/components/dashboard/today-workout-card';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getHomeInsight } from '@/lib/home-insight';
import { estimateWorkoutMinutes, pickTodayWorkout } from '@/lib/today-workout';
import { getTrainingDisplayName } from '@/i18n/training-names';
import { Illustration } from '@/components/brand/illustration';

const RECENT_SESSION_COUNT = 3;

export default async function DashboardPage() {
  const t = await getTranslations('dashboard');
  const format = await getFormatter();
  const locale = await getLocale();
  const session = await requireSession();

  const [inProgressSession, activeProgram, user, recentSessions] = await Promise.all([
    // Look for an unfinished session to offer resuming it.
    db.session.findFirst({
      where: { userId: session.userId, finishedAt: null },
      orderBy: { startedAt: 'desc' },
      include: { workout: { select: { name: true } } },
    }),
    db.program.findFirst({
      where: { userId: session.userId, isActive: true },
      include: {
        workouts: {
          orderBy: { order: 'asc' },
          include: {
            exercises: {
              select: {
                targetSets: true,
                targetRepsMin: true,
                targetRepsMax: true,
                restSec: true,
              },
            },
          },
        },
      },
    }),
    db.user.findUnique({ where: { id: session.userId }, select: { activeGymId: true } }),
    db.session.findMany({
      where: { userId: session.userId, finishedAt: { not: null } },
      orderBy: { startedAt: 'desc' },
      take: RECENT_SESSION_COUNT,
      include: {
        workout: { select: { name: true } },
        _count: { select: { sets: true } },
      },
    }),
  ]);

  // Prisma stores dayOfWeek as 1 (Monday) .. 7 (Sunday); JS getDay is 0=Sunday.
  const jsWeekday = new Date().getDay();
  const todayWorkout = activeProgram
    ? pickTodayWorkout(
        activeProgram.workouts.map((w) => ({
          id: w.id,
          order: w.order,
          dayOfWeek: w.dayOfWeek,
          exerciseCount: w.exercises.length,
        })),
        {
          isoWeekday: jsWeekday === 0 ? 7 : jsWeekday,
          // Continue the rotation from the last session that was actually
          // finished; an ad hoc session (no workout) leaves it null.
          lastWorkoutId: recentSessions[0]?.workoutId ?? null,
        },
      )
    : null;
  const todayWorkoutRow = todayWorkout
    ? activeProgram?.workouts.find((w) => w.id === todayWorkout.id)
    : undefined;

  // Proactive coach insight (issue #237): the single highest-priority
  // deterministic signal (recommended deload / stalled lift / fresh PR /
  // on-track), composed from the existing derivations. Display-only, no LLM
  // call; null on a brand-new account with no history.
  const insight = await getHomeInsight(session.userId, new Date(), locale);

  return (
    <main className="flex-1 px-4 py-6">
      {/* No page header: the app header already names the app, and today's
          menu should be the first thing on screen. */}
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        {/* 1. An unfinished session outranks everything: it is already open. */}
        {inProgressSession && (
          <Card className="border-primary/40 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t('activeSession')}</CardTitle>
              <CardDescription>
                {t('startedOn', {
                  name: inProgressSession.workout?.name
                    ? getTrainingDisplayName(inProgressSession.workout.name, locale)
                    : t('sessionFallback'),
                  date: format.dateTime(inProgressSession.startedAt, {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  }),
                })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="min-h-12 w-full text-base">
                <Link href={`/session/${inProgressSession.id}`}>{t('resumeSession')}</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 2. Today's menu, the default path. Without an active program the
            coach builds one; with an unconfigured one, fill it in first. */}
        {!activeProgram ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('noActiveProgram')}</CardTitle>
              <CardDescription>{t('noActiveProgramDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button asChild className="min-h-12 w-full text-base">
                <Link href="/programs/generate">{t('generateProgram')}</Link>
              </Button>
              <Button asChild variant="outline" className="min-h-12 w-full text-base">
                <Link href="/programs/new">{t('buildYourOwn')}</Link>
              </Button>
            </CardContent>
          </Card>
        ) : !todayWorkoutRow ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('emptyProgram')}</CardTitle>
              <CardDescription>
                {t('emptyProgramDescription', {
                  name: getTrainingDisplayName(activeProgram.name, locale),
                })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="min-h-12 w-full text-base">
                <Link href={`/programs/${activeProgram.id}`}>{t('configureProgram')}</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            <TodayWorkoutCard
              workoutId={todayWorkoutRow.id}
              workoutName={getTrainingDisplayName(todayWorkoutRow.name, locale)}
              exerciseCount={todayWorkoutRow.exercises.length}
              minutes={estimateWorkoutMinutes(todayWorkoutRow.exercises)}
              gymId={user?.activeGymId ?? null}
            />
            {/* The readiness check-in and the other workouts of the week stay
                one tap away, since home no longer lists them. */}
            <Link
              href="/session/new"
              className="self-center px-3 py-2 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              {t('otherMenu')}
            </Link>
          </div>
        )}

        {/* 3. Building a program by hand is a weekly thing, not the default:
            outside the card, quieter than starting today's session. */}
        {activeProgram && (
          <Button asChild variant="outline" className="min-h-12 w-full text-base">
            <Link href="/programs/new">{t('buildYourOwn')}</Link>
          </Button>
        )}

        {/* 4. Recent work. */}
        <RecentSessions
          sessions={recentSessions.map((s) => ({
            id: s.id,
            startedAt: s.startedAt,
            workoutName: s.workout?.name
              ? getTrainingDisplayName(s.workout.name, locale)
              : null,
            setCount: s._count.sets,
          }))}
        />

        <DailyTipCard />

        {insight && (
          <Link href={insight.href} className="block">
            <Card className="border-primary/30 bg-primary/5 transition-colors hover:bg-primary/10">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Illustration name="notification" size={22} />
                  {insight.title}
                </CardTitle>
                <CardDescription>{insight.detail}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        )}
      </div>
    </main>
  );
}
