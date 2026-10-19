'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import type { Program } from '@/lib/prisma-client';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { programInputSchema, type ProgramInput } from '@/lib/schemas/program';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  program: Program;
}

// Block schedule inputs, kept as raw strings while editing and parsed on save.
interface ScheduleDraft {
  startDate: string;
  durationWeeks: string;
  deloadWeeks: string;
  sessionBudgetMin: string;
}

function scheduleDraft(program: Program): ScheduleDraft {
  return {
    startDate: program.startDate.toISOString().slice(0, 10),
    durationWeeks: program.durationWeeks?.toString() ?? '',
    deloadWeeks: program.deloadWeeks.join(', '),
    sessionBudgetMin: program.sessionBudgetMin?.toString() ?? '',
  };
}

function optionalInt(value: string): number | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : Number(trimmed);
}

// "4, 8" -> [4, 8]. Non-numeric entries become NaN and fail server validation.
function parseWeekList(value: string): number[] {
  return value
    .split(/[\s,]+/)
    .filter((part) => part !== '')
    .map(Number);
}

export function ProgramEditDialog({ open, onOpenChange, program }: Props) {
  const t = useTranslations('programs');
  const common = useTranslations('common');
  const router = useRouter();
  const [schedule, setSchedule] = useState<ScheduleDraft>(() => scheduleDraft(program));
  const form = useForm<ProgramInput>({
    resolver: zodResolver(programInputSchema),
    defaultValues: {
      name: program.name,
      phase: program.phase,
      description: program.description ?? '',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: program.name,
        phase: program.phase,
        description: program.description ?? '',
      });
      setSchedule(scheduleDraft(program));
    }
  }, [open, program, form]);

  async function onSubmit(values: ProgramInput) {
    const res = await fetch(`/api/programs/${program.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...values,
        description: values.description || null,
        startDate: schedule.startDate || undefined,
        durationWeeks: optionalInt(schedule.durationWeeks),
        deloadWeeks: parseWeekList(schedule.deloadWeeks),
        sessionBudgetMin: optionalInt(schedule.sessionBudgetMin),
      }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      toast.error(data?.error ?? t('saveError'));
      return;
    }
    toast.success(t('updated'));
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('editProgram')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="name">{common('fields.name')}</Label>
            <Input id="name" {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="phase">{t('phase')}</Label>
            <Input id="phase" {...form.register('phase')} />
            {form.formState.errors.phase && (
              <p className="text-sm text-destructive">{form.formState.errors.phase.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">{common('fields.description')}</Label>
            <Textarea id="description" rows={3} {...form.register('description')} />
          </div>
          <fieldset className="space-y-3 rounded-md border p-3">
            <legend className="px-1 text-sm font-medium">{t('schedule.title')}</legend>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="startDate">{t('schedule.startDate')}</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={schedule.startDate}
                  onChange={(e) => setSchedule((s) => ({ ...s, startDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="durationWeeks">{t('schedule.durationWeeks')}</Label>
                <Input
                  id="durationWeeks"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={52}
                  value={schedule.durationWeeks}
                  onChange={(e) => setSchedule((s) => ({ ...s, durationWeeks: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deloadWeeks">{t('schedule.deloadWeeks')}</Label>
                <Input
                  id="deloadWeeks"
                  placeholder="4, 8"
                  value={schedule.deloadWeeks}
                  onChange={(e) => setSchedule((s) => ({ ...s, deloadWeeks: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sessionBudgetMin">{t('schedule.sessionBudgetMin')}</Label>
                <Input
                  id="sessionBudgetMin"
                  type="number"
                  inputMode="numeric"
                  min={15}
                  max={240}
                  value={schedule.sessionBudgetMin}
                  onChange={(e) =>
                    setSchedule((s) => ({ ...s, sessionBudgetMin: e.target.value }))
                  }
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{t('schedule.hint')}</p>
          </fieldset>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {common('actions.cancel')}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? common('actions.saving') : common('actions.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
