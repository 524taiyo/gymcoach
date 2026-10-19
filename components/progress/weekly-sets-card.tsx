'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { VolumeTargetEditor } from '@/components/progress/volume-target-editor';
import { muscleGroupMessageKeys } from '@/i18n/enum-keys';
import type { MuscleGroup } from '@/lib/prisma-client';
import type { VolumeLandmarkZone } from '@/lib/stats';
import type { WeeklySetsRow } from '@/lib/weekly-sets';

const ZONE_META: Record<
  VolumeLandmarkZone,
  { key: 'belowMev' | 'inRange' | 'aboveMrv'; variant: 'default' | 'secondary' | 'destructive' }
> = {
  BELOW_MEV: { key: 'belowMev', variant: 'secondary' },
  WITHIN: { key: 'inRange', variant: 'default' },
  ABOVE_MRV: { key: 'aboveMrv', variant: 'destructive' },
};

interface Props {
  rows: WeeklySetsRow[];
  defaultMev: number;
  defaultMrv: number;
}

// Weekly hard sets per muscle group (lib/weekly-sets.ts): what the active
// program plans, what was logged this week and last week, each against the
// muscle's MEV/MRV band, with the per-muscle band editor (issue #211).
export function WeeklySetsCard({ rows, defaultMev, defaultMrv }: Props) {
  const t = useTranslations('progress.weeklySets');
  const dashboardT = useTranslations('progress.dashboard');
  const exerciseT = useTranslations('exercises');
  const muscleLabel = (group: string) => {
    const key = muscleGroupMessageKeys[group as MuscleGroup];
    return key ? exerciseT(`muscleGroups.${key}`) : group;
  };

  if (rows.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t('title')}</CardTitle>
        <CardDescription>{t('description', { mev: defaultMev, mrv: defaultMrv })}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-3 text-sm">
          {rows.map((row) => {
            const planned = ZONE_META[row.plannedZone];
            const last = ZONE_META[row.lastWeekZone];
            return (
              <li key={row.group} className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 font-medium">{muscleLabel(row.group)}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {t('band', { mev: row.mev, mrv: row.mrv })}
                  </span>
                  <VolumeTargetEditor
                    muscleGroup={row.group}
                    label={muscleLabel(row.group)}
                    mev={row.mev}
                    mrv={row.mrv}
                    custom={row.custom}
                    defaultMev={defaultMev}
                    defaultMrv={defaultMrv}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 tabular-nums text-muted-foreground">
                  <span>
                    {t('planned', { sets: row.planned })}{' '}
                    {row.planned > 0 && (
                      <Badge variant={planned.variant} className="ml-1">
                        {dashboardT(planned.key)}
                      </Badge>
                    )}
                  </span>
                  <span>{t('thisWeek', { sets: row.thisWeek })}</span>
                  <span>
                    {t('lastWeek', { sets: row.lastWeek })}{' '}
                    {row.lastWeek > 0 && (
                      <Badge variant={last.variant} className="ml-1">
                        {dashboardT(last.key)}
                      </Badge>
                    )}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">{t('note')}</p>
      </CardContent>
    </Card>
  );
}
