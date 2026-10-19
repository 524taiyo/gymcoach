'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useExerciseName } from '@/components/shared/use-exercise-name';
import { formatWeight } from '@/lib/units';
import type {
  AnchorRetention,
  BodyweightTrend,
  RecompSignal,
  RetentionStatus,
  WaistChange,
} from '@/lib/recomp';
import type { WeightUnit } from '@/lib/prisma-client';

interface Props {
  anchors: AnchorRetention[];
  bodyweight: BodyweightTrend | null;
  waist: WaistChange | null;
  signals: RecompSignal[];
  unit: WeightUnit;
}

const statusVariant: Record<RetentionStatus, 'default' | 'secondary' | 'destructive' | 'outline'> =
  {
    maintained: 'secondary',
    watch: 'outline',
    declining: 'destructive',
    insufficient: 'outline',
  };

// Recomp monitor: strength retention on the program's heavy anchors next to
// the bodyweight and waist trend, with rule-based hypotheses (lib/recomp.ts).
// Every number shown is a logged value or a plain derivation of it; nothing
// here estimates body fat or calories.
export function RecompCard({ anchors, bodyweight, waist, signals, unit }: Props) {
  const t = useTranslations('progress.recomp');
  const locale = useLocale();
  const exerciseName = useExerciseName();
  const kg = (value: number) => formatWeight(value, unit, { decimals: 1, group: false, locale });
  const signed = (value: number, text: string) => `${value > 0 ? '+' : ''}${text}`;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <section className="flex flex-col gap-2">
          <h3 className="font-medium">{t('strengthTitle')}</h3>
          {anchors.length === 0 ? (
            <p className="text-muted-foreground">{t('noAnchors')}</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {anchors.map((a) => (
                <li key={a.exerciseName} className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 truncate">{exerciseName(a.exerciseName)}</span>
                  {a.changePct != null && a.baselineE1RM != null && a.recentE1RM != null && (
                    <span className="tabular-nums text-muted-foreground">
                      {kg(a.baselineE1RM)} → {kg(a.recentE1RM)} (
                      {signed(a.changePct, `${a.changePct}%`)})
                    </span>
                  )}
                  <Badge variant={statusVariant[a.status]}>{t(`status.${a.status}`)}</Badge>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">{t('strengthNote')}</p>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">{t('bodyweightTitle')}</p>
            <p className="mt-1 font-medium tabular-nums">
              {bodyweight
                ? t('perWeek', {
                    value: signed(bodyweight.kgPerWeek, kg(bodyweight.kgPerWeek)),
                    pct: signed(bodyweight.pctPerWeek, `${bodyweight.pctPerWeek}`),
                  })
                : t('bodyweightNeedData')}
            </p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">{t('waistTitle')}</p>
            <p className="mt-1 font-medium tabular-nums">
              {waist
                ? t('waistDelta', {
                    delta: signed(waist.deltaCm, `${waist.deltaCm}`),
                    days: waist.spanDays,
                  })
                : t('waistNeedData')}
            </p>
          </div>
        </section>

        <section className="flex flex-col gap-1.5">
          <h3 className="font-medium">{t('hypothesisTitle')}</h3>
          <ul className="list-disc space-y-1 pl-5">
            {signals.map((s) => (
              <li key={s}>{t(`signals.${s}`)}</li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">{t('disclaimer')}</p>
        </section>
      </CardContent>
    </Card>
  );
}
