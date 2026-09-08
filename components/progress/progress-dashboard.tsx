'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition, useMemo } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { WeightUnit } from '@/lib/prisma-client';
import {
  STALL_LOOKBACK_SESSIONS,
  type ExerciseChartPoint,
} from '@/lib/stats';
import { roundWeight, toDisplayWeight, unitLabel } from '@/lib/units';
import { computeLoadingTable } from '@/lib/loading-table';
import { ExerciseGoalCard, type GoalView } from '@/components/progress/exercise-goal-card';
import { useExerciseName } from '@/components/shared/use-exercise-name';

interface RecapRow {
  exerciseId: string;
  exerciseName: string;
  muscleGroup: string;
  sessions: number;
  firstWeight: number;
  firstDate: string;
  lastWeight: number;
  lastDate: string;
  weightDelta: number;
  firstE1RM: number;
  lastE1RM: number;
  e1rmDelta: number;
  stalled: boolean;
}

interface Props {
  exercises: { id: string; name: string; muscleGroup: string }[];
  selectedExerciseId: string | undefined;
  exercisePoints: ExerciseChartPoint[];
  recap: RecapRow[];
  unit: WeightUnit;
  selectedGoal: GoalView | null;
  selectedBestE1RM: number;
  selectedUsesBodyweight: boolean;
}

export function ProgressDashboard({
  exercises,
  selectedExerciseId,
  exercisePoints,
  recap,
  unit,
  selectedGoal,
  selectedBestE1RM,
  selectedUsesBodyweight,
}: Props) {
  const t = useTranslations('progress.dashboard');
  const format = useFormatter();
  const exerciseName = useExerciseName();
  const router = useRouter();
  const search = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const shortDate = (iso: string) =>
    format.dateTime(new Date(iso), { day: '2-digit', month: '2-digit' });

  const unitSuffix = unitLabel(unit);
  const toDisplay = (kg: number) =>
    unit === 'KG' ? kg : roundWeight(toDisplayWeight(kg, unit), 1);

  function selectExercise(id: string) {
    const params = new URLSearchParams(search.toString());
    params.set('exerciseId', id);
    startTransition(() => {
      router.push(`/progress?${params.toString()}`);
    });
  }

  const selectedExo = exercises.find((e) => e.id === selectedExerciseId);

  const loadingRows = useMemo(
    () => computeLoadingTable(toDisplay(selectedBestE1RM), unit),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedBestE1RM, unit],
  );

  const stalledLifts = recap.filter((r) => r.stalled);

  const exerciseChartData = exercisePoints.map((p) => ({
    ...p,
    label: shortDate(p.date),
    maxWeight: toDisplay(p.maxWeight),
    estimated1RM: toDisplay(p.estimated1RM),
  }));

  return (
    <div className="flex flex-col gap-6">
      {/* Max load and 1RM per exercise */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">{t('maxLoad')}</h2>
            <Select
              value={selectedExerciseId ?? ''}
              onValueChange={selectExercise}
              disabled={isPending}
            >
              <SelectTrigger className="h-9 w-auto min-w-[12rem]">
                <SelectValue placeholder={t('chooseExercise')} />
              </SelectTrigger>
              <SelectContent>
                {exercises.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {exerciseName(e.name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {exerciseChartData.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('noExerciseData')}</p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={exerciseChartData}
                  margin={{ top: 5, right: 10, bottom: 0, left: -10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="maxWeight"
                    name={t('maxLoadSeries', { unit: unitSuffix })}
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="estimated1RM"
                    name={t('oneRmSeries', { unit: unitSuffix })}
                    stroke="#a855f7"
                    strokeDasharray="4 4"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Training loads table */}
      {selectedExerciseId && loadingRows.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
                <span className="text-base font-semibold">{t('trainingLoads')}</span>
                <span className="text-xs text-muted-foreground group-open:hidden">{t('show')}</span>
                <span className="hidden text-xs text-muted-foreground group-open:inline">
                  {t('hide')}
                </span>
              </summary>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('loadingDescription', {
                  value: `${toDisplay(selectedBestE1RM)} ${unitSuffix}`,
                })}
              </p>
              <table className="mt-3 w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 font-medium">{t('oneRmPercent')}</th>
                    <th className="py-2 text-right font-medium">{t('load')}</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingRows.map((row) => (
                    <tr key={row.percent} className="border-b last:border-0">
                      <td className="py-1.5">{row.percent}%</td>
                      <td className="py-1.5 text-right tabular-nums">
                        {row.weight} {unitSuffix}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </CardContent>
        </Card>
      )}

      {/* Target goal for the selected exercise */}
      {selectedExerciseId && selectedExo && (
        <ExerciseGoalCard
          exerciseId={selectedExerciseId}
          exerciseName={exerciseName(selectedExo.name)}
          usesBodyweight={selectedUsesBodyweight}
          goal={selectedGoal}
          bestE1RM={selectedBestE1RM}
          unit={unit}
        />
      )}

      {/* Stalled lifts: e1RM flat over the recent sessions (read-only) */}
      {stalledLifts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <h2 className="text-base font-semibold">{t('stalled')}</h2>
            <p className="text-xs text-muted-foreground">
              {t('noProgressAdvice', { count: STALL_LOOKBACK_SESSIONS })}
            </p>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-wrap gap-2">
              {stalledLifts.map((r) => (
                <li key={r.exerciseId}>
                  <Badge variant="secondary" className="text-amber-700 dark:text-amber-400">
                    {exerciseName(r.exerciseName)}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
