import Link from 'next/link';
import { Wand2 } from 'lucide-react';
import { PlusIcon, WorkoutIcon } from '@/components/icons';
import { PageHeader } from '@/components/ui/page-header';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getTrainingDisplayName } from '@/i18n/training-names';

export default async function ProgramsPage() {
  const t = await getTranslations('programs');
  const format = await getFormatter();
  const locale = await getLocale();
  const session = await requireSession();
  const programs = await db.program.findMany({
    where: { userId: session.userId },
    orderBy: [{ isActive: 'desc' }, { startDate: 'desc' }],
    include: {
      _count: { select: { workouts: true, sessions: true } },
    },
  });

  return (
    <main className="flex-1 px-4 py-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <PageHeader
          icon={WorkoutIcon}
          title={t('title')}
          description={t('count', { count: programs.length })}
          actions={
            <>
              <Button asChild variant="outline" className="flex-1 sm:flex-none">
                <Link href="/programs/generate">
                  <Wand2 className="size-4" />
                  <span className="ml-1">{t('generateWithAi')}</span>
                </Link>
              </Button>
              <Button asChild className="flex-1 sm:flex-none">
                <Link href="/programs/new">
                  <PlusIcon className="size-4" />
                  <span className="ml-1">{t('create')}</span>
                </Link>
              </Button>
            </>
          }
        />

        {programs.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>{t('noProgram')}</CardTitle>
              <CardDescription>{t('noProgramDescription')}</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {programs.map((p) => (
              <li key={p.id}>
                <Link href={`/programs/${p.id}`} className="block">
                  <Card className="transition-colors hover:bg-accent">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <CardTitle className="text-base">
                          {getTrainingDisplayName(p.name, locale)}
                        </CardTitle>
                        {p.isActive && <Badge>{t('active')}</Badge>}
                      </div>
                      <CardDescription className="text-xs">
                        {t('startedOn', {
                          phase: p.phase,
                          date: format.dateTime(p.startDate, {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          }),
                        })}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0 text-xs text-muted-foreground">
                      {t('listSummary', {
                        workouts: p._count.workouts,
                        logged: p._count.sessions,
                      })}
                    </CardContent>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
