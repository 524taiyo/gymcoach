'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Exercise, ExerciseCategory, MuscleGroup } from '@/lib/prisma-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  exerciseCategoryValues,
  exerciseInputSchema,
  muscleGroupValues,
} from '@/lib/schemas/exercise';
import { exerciseCategoryMessageKeys, muscleGroupMessageKeys } from '@/i18n/enum-keys';

interface Props {
  // Pre-filled name, typically what the lifter typed into the search box.
  initialName: string;
  onCreated: (exercise: Exercise) => void;
  onCancel: () => void;
}

// Default rest by category, matching what the catalog seeds use.
const REST_BY_CATEGORY: Record<ExerciseCategory, number> = {
  COMPOUND: 120,
  ISOLATION: 60,
  CARDIO: 60,
};

// Minimal "add to catalog" form shown inside the exercise picker, so a lift
// that is not in the catalog can be created and selected without leaving the
// program editor. Posts to the same /api/exercises route the catalog page
// uses; anything beyond name, muscle group, type and bodyweight can be edited
// later on the catalog page.
export function QuickExerciseCreate({ initialName, onCreated, onCancel }: Props) {
  const t = useTranslations('programs.exercise');
  const exerciseT = useTranslations('exercises');
  const common = useTranslations('common');
  const [name, setName] = useState(initialName);
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>('CHEST');
  const [category, setCategory] = useState<ExerciseCategory>('COMPOUND');
  const [usesBodyweight, setUsesBodyweight] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const parsed = exerciseInputSchema.safeParse({
      name,
      muscleGroup,
      category,
      usesBodyweight,
      defaultRestSec: REST_BY_CATEGORY[category],
      notes: null,
      equipmentType: 'OTHER',
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? t('createError'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/exercises', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? t('createError'));
        return;
      }
      const created = (await res.json()) as Exercise;
      toast.success(exerciseT('created'));
      onCreated(created);
    } catch {
      setError(t('createError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <p className="text-sm font-semibold">{t('createTitle')}</p>
      <div className="space-y-1.5">
        <Label htmlFor="quick-exercise-name" className="text-xs">
          {common('fields.name')}
        </Label>
        <Input
          id="quick-exercise-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          autoComplete="off"
          maxLength={120}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="quick-exercise-muscle" className="text-xs">
            {exerciseT('muscleGroup')}
          </Label>
          <Select value={muscleGroup} onValueChange={(v) => setMuscleGroup(v as MuscleGroup)}>
            <SelectTrigger id="quick-exercise-muscle">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {muscleGroupValues.map((group) => (
                <SelectItem key={group} value={group}>
                  {exerciseT(`muscleGroups.${muscleGroupMessageKeys[group]}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="quick-exercise-category" className="text-xs">
            {exerciseT('category')}
          </Label>
          <Select value={category} onValueChange={(v) => setCategory(v as ExerciseCategory)}>
            <SelectTrigger id="quick-exercise-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {exerciseCategoryValues.map((value) => (
                <SelectItem key={value} value={value}>
                  {exerciseT(`categories.${exerciseCategoryMessageKeys[value]}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="quick-exercise-bodyweight" className="text-xs">
          {exerciseT('bodyweight')}
        </Label>
        <Switch
          id="quick-exercise-bodyweight"
          checked={usesBodyweight}
          onCheckedChange={setUsesBodyweight}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
          {common('actions.cancel')}
        </Button>
        <Button type="button" size="sm" onClick={submit} disabled={saving || !name.trim()}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : t('createSubmit')}
        </Button>
      </div>
    </div>
  );
}
