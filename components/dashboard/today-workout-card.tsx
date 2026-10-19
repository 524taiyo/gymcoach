import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChatIcon } from '@/components/icons';
import { StartWorkoutButton } from '@/components/session/start-workout-button';

// The default path through the app: the one workout the coach's program says
// to do today, with starting it as the loudest thing on the screen and asking
// about it one tap away.
export async function TodayWorkoutCard({
  workoutId,
  workoutName,
  exerciseCount,
  minutes,
  gymId,
  block = null,
  budgetMin = null,
}: {
  workoutId: string;
  // Already resolved to the display locale by the caller.
  workoutName: string;
  exerciseCount: number;
  minutes: number;
  gymId: string | null;
  // Current week of a program with a planned length (lib/program-weeks.ts).
  block?: { week: number; totalWeeks: number; isDeloadWeek: boolean; finished: boolean } | null;
  // Program session time budget in minutes; the estimate is flagged above it.
  budgetMin?: number | null;
}) {
  const t = await getTranslations('dashboard');

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-ink">
              {t('coachBuilt')}
            </p>
            {block && (
              <Badge variant="secondary">
                {block.finished
                  ? t('blockFinished', { total: block.totalWeeks })
                  : t('blockWeek', { week: block.week, total: block.totalWeeks })}
              </Badge>
            )}
            {block?.isDeloadWeek && <Badge>{t('deloadWeek')}</Badge>}
          </div>
          <h2 className="mt-1.5 text-2xl font-bold leading-tight tracking-tight">
            {workoutName}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('workoutMeta', { count: exerciseCount, minutes })}
          </p>
          {budgetMin != null && minutes > budgetMin && (
            <p className="mt-1 text-sm text-destructive">
              {t('overBudget', { minutes, budget: budgetMin })}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <StartWorkoutButton workoutId={workoutId} gymId={gymId} label={t('start')} />
          <Button asChild variant="outline" className="min-h-12 w-full text-base">
            <Link href={`/chat?workoutId=${workoutId}`}>
              <ChatIcon className="size-5" />
              <span className="ml-2">{t('askAboutMenu')}</span>
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
