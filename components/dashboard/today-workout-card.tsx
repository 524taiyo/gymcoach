import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
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
}: {
  workoutId: string;
  // Already resolved to the display locale by the caller.
  workoutName: string;
  exerciseCount: number;
  minutes: number;
  gymId: string | null;
}) {
  const t = await getTranslations('dashboard');

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary-ink">
            {t('coachBuilt')}
          </p>
          <h2 className="mt-1.5 text-2xl font-bold leading-tight tracking-tight">
            {workoutName}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('workoutMeta', { count: exerciseCount, minutes })}
          </p>
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
