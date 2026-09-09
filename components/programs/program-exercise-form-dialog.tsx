'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import type { Exercise, ProgramExercise, SetAutoregulationMode } from '@/lib/prisma-client';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  programExerciseInputSchema,
  type ProgramExerciseInput,
} from '@/lib/schemas/program-exercise';
import { ExercisePicker } from '@/components/programs/exercise-picker';
import { recommendedPrescription } from '@/lib/prescription-defaults';

interface CreateProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create';
  workoutId: string;
  catalog: Exercise[];
}

interface EditProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'edit';
  programExercise: ProgramExercise & { exercise: Exercise };
  catalog: Exercise[];
}

type Props = CreateProps | EditProps;

const DEFAULT_VALUES: ProgramExerciseInput = {
  exerciseId: '',
  targetSets: 4,
  targetRepsMin: 8,
  targetRepsMax: 10,
  targetRIR: 2,
  restSec: 90,
  autoregulationMode: 'PRESERVE_RIR',
  fatigueRate: null,
  loadAdjustmentPct: null,
  tempo: '',
  notes: '',
};

// Two tiers: the four numbers a lifter always sets (sets, reps, RIR, rest)
// are visible; tempo, auto-regulation tuning and notes wait under "advanced
// settings" with defaults that match what the coach assumes.
export function ProgramExerciseFormDialog(props: Props) {
  const t = useTranslations('programs.exercise');
  const programsT = useTranslations('programs');
  const common = useTranslations('common');
  const router = useRouter();

  const initial: ProgramExerciseInput = useMemo(() => {
    if (props.mode === 'edit') {
      const pe = props.programExercise;
      return {
        exerciseId: pe.exerciseId,
        targetSets: pe.targetSets,
        targetRepsMin: pe.targetRepsMin,
        targetRepsMax: pe.targetRepsMax,
        targetRIR: pe.targetRIR,
        restSec: pe.restSec,
        autoregulationMode: pe.autoregulationMode,
        fatigueRate: pe.fatigueRate,
        loadAdjustmentPct: pe.loadAdjustmentPct,
        tempo: pe.tempo ?? '',
        notes: pe.notes ?? '',
      };
    }
    return DEFAULT_VALUES;
  }, [props]);

  const form = useForm<ProgramExerciseInput>({
    resolver: zodResolver(programExerciseInputSchema),
    defaultValues: initial,
  });

  // Picking an exercise pre-fills a recommended prescription (sets, reps,
  // RIR) and the exercise's default rest. Create mode only, so an edited
  // prescription is never silently overwritten; every value stays editable.
  const [recommended, setRecommended] = useState(false);

  useEffect(() => {
    if (props.open) {
      form.reset(initial);
      setRecommended(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open, initial]);

  // Exercises created from the picker during this dialog's life, so they can
  // be selected immediately without waiting for the server refresh.
  const [createdExercises, setCreatedExercises] = useState<Exercise[]>([]);
  const catalog = useMemo(
    () => [
      ...createdExercises.filter((c) => !props.catalog.some((e) => e.id === c.id)),
      ...props.catalog,
    ],
    [createdExercises, props.catalog],
  );
  function handleExerciseChange(exerciseId: string, justCreated?: Exercise) {
    form.setValue('exerciseId', exerciseId, { shouldValidate: true });
    if (props.mode === 'create') {
      const exo = justCreated ?? catalog.find((e) => e.id === exerciseId);
      if (exo) {
        const rx = recommendedPrescription(exo);
        form.setValue('targetSets', rx.targetSets);
        form.setValue('targetRepsMin', rx.targetRepsMin);
        form.setValue('targetRepsMax', rx.targetRepsMax);
        form.setValue('targetRIR', rx.targetRIR);
        form.setValue('restSec', exo.defaultRestSec);
        setRecommended(true);
      }
    }
  }

  async function onSubmit(values: ProgramExerciseInput) {
    const url =
      props.mode === 'edit'
        ? `/api/program-exercises/${props.programExercise.id}`
        : `/api/workouts/${props.workoutId}/program-exercises`;
    const method = props.mode === 'edit' ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...values,
        tempo: values.tempo || null,
        notes: values.notes || null,
      }),
    });
    if (!res.ok) {
      toast.error(t('saveError'));
      return;
    }
    toast.success(props.mode === 'edit' ? t('updated') : t('added'));
    props.onOpenChange(false);
    router.refresh();
  }

  const numberField = (id: keyof ProgramExerciseInput, label: string, min: number, max: number) => (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        className="h-11 text-center text-base font-semibold tabular-nums md:h-10"
        {...form.register(id)}
      />
    </div>
  );

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{props.mode === 'edit' ? t('edit') : t('add')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="exerciseSearch">{t('choose')}</Label>
            <ExercisePicker
              inputId="exerciseSearch"
              catalog={catalog}
              value={form.watch('exerciseId')}
              onChange={handleExerciseChange}
              onCreate={(exercise) => {
                setCreatedExercises((prev) => [exercise, ...prev]);
                handleExerciseChange(exercise.id, exercise);
                router.refresh();
              }}
            />
            {form.formState.errors.exerciseId && (
              <p className="text-sm text-destructive">{form.formState.errors.exerciseId.message}</p>
            )}
          </div>

          <div className="grid grid-cols-4 gap-2">
            {numberField('targetSets', t('sets'), 1, 20)}
            {numberField('targetRepsMin', t('repsMin'), 1, 50)}
            {numberField('targetRepsMax', t('repsMax'), 1, 50)}
            {numberField('targetRIR', 'RIR', 0, 5)}
          </div>
          {form.formState.errors.targetRepsMax ? (
            <p className="text-sm text-destructive">
              {form.formState.errors.targetRepsMax.message}
            </p>
          ) : (
            recommended && <p className="text-xs text-muted-foreground">{t('recommendedHint')}</p>
          )}

          <div className="grid grid-cols-2 gap-2">
            {numberField('restSec', t('rest'), 15, 600)}
            <div className="space-y-1.5">
              <Label htmlFor="tempo" className="text-xs">
                {t('tempo')}
              </Label>
              <Input
                id="tempo"
                placeholder="3-1-1-0"
                className="h-11 md:h-10"
                {...form.register('tempo')}
              />
            </div>
          </div>

          <details className="group rounded-lg border border-dashed px-3 py-2 text-sm">
            <summary className="cursor-pointer select-none font-medium text-muted-foreground group-open:text-foreground">
              {programsT('advancedSettings')}
            </summary>
            <div className="mt-3 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="autoregulationMode">{t('autoregulationMode')}</Label>
                <Select
                  value={form.watch('autoregulationMode') ?? 'PRESERVE_RIR'}
                  onValueChange={(value) =>
                    form.setValue('autoregulationMode', value as SetAutoregulationMode)
                  }
                >
                  <SelectTrigger id="autoregulationMode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRESERVE_RIR">{t('preserveRir')}</SelectItem>
                    <SelectItem value="PRESERVE_REPS">{t('preserveReps')}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {form.watch('autoregulationMode') === 'PRESERVE_REPS'
                    ? t('preserveRepsHelp')
                    : t('preserveRirHelp')}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="fatigueRate" className="text-xs">
                    {t('fatigueRate')}
                  </Label>
                  <Input
                    id="fatigueRate"
                    type="number"
                    inputMode="decimal"
                    min="0.25"
                    max="2"
                    step="0.05"
                    placeholder={t('automatic')}
                    value={form.watch('fatigueRate') ?? ''}
                    onChange={(e) =>
                      form.setValue(
                        'fatigueRate',
                        e.target.value === '' ? null : Number(e.target.value),
                        { shouldValidate: true },
                      )
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="loadAdjustmentPct" className="text-xs">
                    {t('loadAdjustment')}
                  </Label>
                  <Input
                    id="loadAdjustmentPct"
                    type="number"
                    inputMode="decimal"
                    min="1"
                    max="5"
                    step="0.1"
                    placeholder={t('automatic')}
                    value={form.watch('loadAdjustmentPct') ?? ''}
                    onChange={(e) =>
                      form.setValue(
                        'loadAdjustmentPct',
                        e.target.value === '' ? null : Number(e.target.value),
                        { shouldValidate: true },
                      )
                    }
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notes">{t('notes')}</Label>
                <Textarea id="notes" rows={2} {...form.register('notes')} />
              </div>
            </div>
          </details>

          {Object.keys(form.formState.errors).length > 0 && (
            <ul className="space-y-0.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {Object.entries(form.formState.errors).map(([field, err]) => (
                <li key={field}>
                  {field}: {String((err as { message?: string })?.message ?? 'invalid')}
                </li>
              ))}
            </ul>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => props.onOpenChange(false)}
              disabled={form.formState.isSubmitting}
            >
              {common('actions.cancel')}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting
                ? common('actions.saving')
                : props.mode === 'edit'
                  ? common('actions.save')
                  : common('actions.add')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
