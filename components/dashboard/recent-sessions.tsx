import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Card, CardContent } from '@/components/ui/card';

export interface RecentSession {
  id: string;
  startedAt: Date;
  // Display name, already resolved to the locale. Null for an ad hoc session.
  workoutName: string | null;
  setCount: number;
}

// The last few finished sessions, as a short proof of work under today's plan.
// The full list stays on the history tab.
export async function RecentSessions({ sessions }: { sessions: RecentSession[] }) {
  const t = await getTranslations('dashboard');
  const common = await getTranslations('common');
  const format = await getFormatter();

  if (sessions.length === 0) return null;

  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {t('recentSessions')}
      </h2>
      <ul className="flex flex-col gap-2">
        {sessions.map((s) => (
          <li key={s.id}>
            <Link href={`/history/${s.id}`} className="block">
              <Card className="transition-colors hover:bg-accent/50">
                <CardContent className="flex min-h-14 items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {s.workoutName ?? t('sessionFallback')}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {format.dateTime(s.startedAt, { day: '2-digit', month: '2-digit' })}
                      {' · '}
                      {common('counts.sets', { count: s.setCount })}
                    </p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
