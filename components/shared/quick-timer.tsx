'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { PlusIcon, TimerIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { playRestEndBeep } from '@/lib/sound';
import { cn } from '@/lib/utils';
import { Illustration } from '@/components/brand/illustration';

const PRESETS = [60, 90, 120, 180] as const;
const DEFAULT_SEC = 90;

// Absolute timestamps keep the countdown honest when the tab is backgrounded
// (setInterval throttles; Date.now() does not).
type Timer =
  | { kind: 'idle'; totalSec: number }
  | { kind: 'running'; totalSec: number; endsAt: number }
  | { kind: 'paused'; totalSec: number; remainingMs: number }
  | { kind: 'done'; totalSec: number };

// Standalone rest timer, reachable from the header on every page. It lives in
// the app layout, so it keeps counting while the lifter navigates around.
// The header button doubles as the readout while a countdown is running.
export function QuickTimer() {
  const t = useTranslations('common.quickTimer');
  const [open, setOpen] = useState(false);
  const [timer, setTimer] = useState<Timer>({ kind: 'idle', totalSec: DEFAULT_SEC });
  const [now, setNow] = useState(() => Date.now());
  const beepedRef = useRef(false);

  useEffect(() => {
    if (timer.kind !== 'running') return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [timer]);

  useEffect(() => {
    if (timer.kind === 'running' && now >= timer.endsAt && !beepedRef.current) {
      beepedRef.current = true;
      playRestEndBeep();
      setTimer({ kind: 'done', totalSec: timer.totalSec });
    }
  }, [now, timer]);

  const remainingMs =
    timer.kind === 'running'
      ? Math.max(0, timer.endsAt - now)
      : timer.kind === 'paused'
        ? timer.remainingMs
        : timer.kind === 'idle'
          ? timer.totalSec * 1000
          : 0;
  const remainingSec = Math.ceil(remainingMs / 1000);
  const progress = Math.min(100, (remainingMs / (timer.totalSec * 1000)) * 100);

  const start = useCallback((sec: number) => {
    beepedRef.current = false;
    setNow(Date.now());
    setTimer({ kind: 'running', totalSec: sec, endsAt: Date.now() + sec * 1000 });
  }, []);

  const pause = () => {
    if (timer.kind !== 'running') return;
    setTimer({
      kind: 'paused',
      totalSec: timer.totalSec,
      remainingMs: Math.max(0, timer.endsAt - Date.now()),
    });
  };

  const resume = () => {
    if (timer.kind !== 'paused') return;
    setNow(Date.now());
    setTimer({ kind: 'running', totalSec: timer.totalSec, endsAt: Date.now() + timer.remainingMs });
  };

  const reset = () => {
    beepedRef.current = false;
    setTimer({ kind: 'idle', totalSec: timer.totalSec });
  };

  const addThirty = () => {
    if (timer.kind === 'running') {
      setTimer({ ...timer, totalSec: timer.totalSec + 30, endsAt: timer.endsAt + 30_000 });
    } else if (timer.kind === 'paused') {
      setTimer({
        ...timer,
        totalSec: timer.totalSec + 30,
        remainingMs: timer.remainingMs + 30_000,
      });
    } else {
      setTimer({ kind: 'idle', totalSec: timer.totalSec + 30 });
    }
  };

  const active = timer.kind === 'running' || timer.kind === 'paused';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size={active ? 'sm' : 'icon'}
          aria-label={active ? t('running', { seconds: remainingSec }) : t('open')}
          className={cn(
            active &&
              'h-10 gap-1.5 rounded-full bg-primary/10 px-2.5 text-primary-ink hover:bg-primary/15',
            timer.kind === 'paused' && 'opacity-70',
          )}
        >
          <TimerIcon className="size-4" />
          {active && (
            <span className="text-sm font-semibold tabular-nums" data-testid="quick-timer-badge">
              {remainingSec}
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Illustration name="timer" size={28} />
            {t('title')}
          </DialogTitle>
          <DialogDescription className="sr-only">{t('title')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-5 py-2">
          <p
            className={cn(
              'text-7xl font-bold tabular-nums tracking-tight transition-colors',
              timer.kind === 'done' && 'text-primary-ink',
            )}
          >
            <span data-testid="quick-timer-remaining">{remainingSec}</span>
            <span className="ml-1.5 text-2xl font-medium text-muted-foreground">
              {t('seconds')}
            </span>
          </p>

          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'h-full bg-primary transition-[width] duration-200 ease-linear',
                timer.kind === 'done' && 'animate-pulse',
              )}
              style={{ width: `${timer.kind === 'done' ? 100 : progress}%` }}
            />
          </div>

          {timer.kind === 'done' && (
            <p className="text-sm font-medium text-primary-ink">{t('done')}</p>
          )}

          <div className="w-full">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t('presets')}
            </p>
            <div className="grid grid-cols-4 gap-2">
              {PRESETS.map((sec) => (
                <Button
                  key={sec}
                  variant={timer.totalSec === sec && timer.kind !== 'done' ? 'default' : 'outline'}
                  className="h-12 text-base font-semibold tabular-nums"
                  onClick={() => start(sec)}
                >
                  {sec}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid w-full grid-cols-3 gap-2">
            <Button variant="outline" className="h-12" onClick={addThirty}>
              <PlusIcon className="size-4" />
              <span className="ml-1">{t('addThirty')}</span>
            </Button>
            {timer.kind === 'running' ? (
              <Button className="h-12" onClick={pause}>
                <Pause className="size-4" />
                <span className="ml-1">{t('pause')}</span>
              </Button>
            ) : timer.kind === 'paused' ? (
              <Button className="h-12" onClick={resume}>
                <Play className="size-4" />
                <span className="ml-1">{t('resume')}</span>
              </Button>
            ) : (
              <Button className="h-12" onClick={() => start(timer.totalSec)}>
                <Play className="size-4" />
                <span className="ml-1">{t('start')}</span>
              </Button>
            )}
            <Button
              variant="outline"
              className="h-12"
              onClick={reset}
              disabled={timer.kind === 'idle'}
            >
              <RotateCcw className="size-4" />
              <span className="ml-1">{t('reset')}</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
