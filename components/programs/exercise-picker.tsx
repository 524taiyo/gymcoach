'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Search } from 'lucide-react';
import type { Exercise, MuscleGroup } from '@/lib/prisma-client';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { muscleGroupMessageKeys } from '@/i18n/enum-keys';
import { useExerciseName } from '@/components/shared/use-exercise-name';

interface Props {
  catalog: Exercise[];
  value: string;
  onChange: (exerciseId: string) => void;
  inputId?: string;
}

// Searchable, thumb-friendly replacement for a long grouped <select>: type a
// few letters, tap the exercise. Groups by muscle group, keeps the current
// choice pinned at the top so it stays visible while filtering.
export function ExercisePicker({ catalog, value, onChange, inputId }: Props) {
  const t = useTranslations('programs.exercise');
  const exerciseT = useTranslations('exercises');
  const exerciseName = useExerciseName();
  const [query, setQuery] = useState('');

  const selected = catalog.find((e) => e.id === value) ?? null;

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = new Map<MuscleGroup, Exercise[]>();
    for (const ex of catalog) {
      const label = exerciseName(ex.name);
      if (q && !label.toLowerCase().includes(q) && !ex.name.toLowerCase().includes(q)) continue;
      const list = out.get(ex.muscleGroup) ?? [];
      list.push(ex);
      out.set(ex.muscleGroup, list);
    }
    return Array.from(out.entries());
  }, [catalog, query, exerciseName]);

  return (
    <div className="space-y-2">
      {selected && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <Check className="size-4 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate font-medium">{exerciseName(selected.name)}</span>
          <span className="text-xs text-muted-foreground">{t('selected')}</span>
        </div>
      )}
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
        {grouped.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">{t('noMatch')}</p>
        ) : (
          grouped.map(([group, list]) => (
            <div key={group}>
              <p className="sticky top-0 bg-muted/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur">
                {exerciseT(`muscleGroups.${muscleGroupMessageKeys[group]}`)}
              </p>
              {list.map((ex) => {
                const active = ex.id === value;
                return (
                  <button
                    key={ex.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => onChange(ex.id)}
                    className={cn(
                      'flex min-h-11 w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent/60',
                      active && 'bg-primary/10 font-medium text-primary',
                    )}
                  >
                    <span className="truncate">{exerciseName(ex.name)}</span>
                    {active && <Check className="size-4 shrink-0" />}
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
