'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Search } from 'lucide-react';
import type { Exercise } from '@/lib/prisma-client';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { BODY_PARTS, bodyPartOf, type BodyPart } from '@/lib/body-parts';
import { useExerciseName } from '@/components/shared/use-exercise-name';

interface Props {
  catalog: Exercise[];
  value: string;
  onChange: (exerciseId: string) => void;
  inputId?: string;
}

type Tab = 'all' | BodyPart;

// Body-part tabs (chest / back / shoulders / arms / legs / core) over a plain
// list of exercise names, plus a search box. The current choice stays pinned
// above the list so it is visible whatever tab or query is active.
export function ExercisePicker({ catalog, value, onChange, inputId }: Props) {
  const t = useTranslations('programs.exercise');
  const partsT = useTranslations('exercises.bodyParts');
  const exerciseName = useExerciseName();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('all');

  const selected = catalog.find((e) => e.id === value) ?? null;

  // Only offer tabs that have at least one exercise, so a catalog without
  // cardio does not show an empty "other".
  const tabs = useMemo<Tab[]>(() => {
    const present = new Set(catalog.map((e) => bodyPartOf(e.muscleGroup)));
    return ['all', ...BODY_PARTS.filter((p) => present.has(p))];
  }, [catalog]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalog
      .filter((ex) => tab === 'all' || bodyPartOf(ex.muscleGroup) === tab)
      .map((ex) => ({ ex, label: exerciseName(ex.name) }))
      .filter(
        ({ ex, label }) =>
          !q || label.toLowerCase().includes(q) || ex.name.toLowerCase().includes(q),
      )
      .sort((a, b) => a.label.localeCompare(b.label, 'ja'));
  }, [catalog, query, tab, exerciseName]);

  return (
    <div className="space-y-2">
      {selected && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <Check className="size-4 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate font-medium">{exerciseName(selected.name)}</span>
          <span className="text-xs text-muted-foreground">{t('selected')}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5" role="tablist">
        {tabs.map((part) => (
          <button
            key={part}
            type="button"
            role="tab"
            aria-selected={tab === part}
            onClick={() => setTab(part)}
            className={cn(
              'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
              tab === part
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:bg-accent',
            )}
          >
            {partsT(part)}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={inputId}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('search')}
          autoComplete="off"
          className="pl-9"
        />
      </div>

      <div
        role="listbox"
        aria-label={t('choose')}
        className="max-h-52 overflow-y-auto rounded-lg border"
      >
        {visible.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">{t('noMatch')}</p>
        ) : (
          visible.map(({ ex, label }) => {
            const active = ex.id === value;
            return (
              <button
                key={ex.id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => onChange(ex.id)}
                className={cn(
                  'flex min-h-11 w-full items-center justify-between gap-2 border-b border-border/60 px-3 py-2 text-left text-sm transition-colors last:border-b-0 hover:bg-accent/60',
                  active && 'bg-primary/10 font-medium text-primary',
                )}
              >
                <span className="truncate">{label}</span>
                {active && <Check className="size-4 shrink-0" />}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
