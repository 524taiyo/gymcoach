'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { RotateCw } from 'lucide-react';
import { CoachIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface DailyTipResponse {
  text: string;
  day: string;
}

type State =
  | { kind: 'loading' }
  | { kind: 'hidden' }
  | { kind: 'error' }
  | { kind: 'ready'; text: string; refreshing: boolean };

// The lifter's local calendar day, so the line rolls over at their midnight.
function localDay(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Home page card: one sentence from the coach for today, fetched after mount so
// the page itself never waits on the LLM. Hidden when no provider is configured.
export function DailyTipCard() {
  const t = useTranslations('dashboard.dailyTip');
  const [state, setState] = useState<State>({ kind: 'loading' });

  const load = useCallback(async (force: boolean) => {
    const day = localDay();
    try {
      const res = force
        ? await fetch('/api/coach/daily-tip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ day }),
          })
        : await fetch(`/api/coach/daily-tip?day=${day}`);
      if (res.status === 204) {
        setState({ kind: 'hidden' });
        return;
      }
      if (!res.ok) {
        setState({ kind: 'error' });
        return;
      }
      const data = (await res.json()) as DailyTipResponse;
      setState({ kind: 'ready', text: data.text, refreshing: false });
    } catch {
      setState({ kind: 'error' });
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  if (state.kind === 'hidden') return null;

  const refresh = () => {
    if (state.kind !== 'ready' || state.refreshing) return;
    setState({ ...state, refreshing: true });
    void load(true);
  };

  return (
    <Card className="animate-in-up border-primary/20 bg-[linear-gradient(135deg,hsl(var(--primary)/0.08),hsl(var(--card))_60%)]">
      <CardContent className="flex items-start gap-3 p-4 sm:p-5">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[inset_0_-1px_0_rgba(0,0,0,0.15)]">
          <CoachIcon className="size-5" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
            {t('label')}
          </p>
          {state.kind === 'loading' ? (
            <div className="mt-2 space-y-2" aria-label={t('loading')}>
              <div className="h-3.5 w-11/12 animate-pulse rounded-full bg-primary/15" />
              <div className="h-3.5 w-2/3 animate-pulse rounded-full bg-primary/15" />
            </div>
          ) : state.kind === 'error' ? (
            <p className="mt-1 text-sm text-muted-foreground">{t('error')}</p>
          ) : (
            <p
              className={cn(
                'mt-1 text-[15px] font-medium leading-relaxed transition-opacity',
                state.refreshing && 'opacity-50',
              )}
            >
              {state.text}
            </p>
          )}
        </div>
        {state.kind === 'ready' && (
          <Button
            variant="ghost"
            size="icon"
            className="-mr-2 -mt-1 shrink-0 text-muted-foreground"
            onClick={refresh}
            disabled={state.refreshing}
            aria-label={t('refresh')}
            title={t('refresh')}
          >
            <RotateCw className={cn('size-4', state.refreshing && 'animate-spin')} />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
