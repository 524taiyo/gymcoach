'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { programInputSchema, type ProgramInput } from '@/lib/schemas/program';

// Blank program: the name is the only field up front. Phase and description
// keep sensible defaults behind "advanced settings". On success the detail
// page opens with the "add a session" dialog already up, so the next step is
// one tap away.
export function ProgramCreateForm() {
  const t = useTranslations('programs');
  const router = useRouter();
  const form = useForm<ProgramInput>({
    resolver: zodResolver(programInputSchema),
    defaultValues: { name: '', phase: 'Hypertrophy', description: '' },
  });

  async function onSubmit(values: ProgramInput) {
    const res = await fetch('/api/programs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...values, description: values.description || null }),
    });
    if (!res.ok) {
      toast.error(t('createError'));
      return;
    }
    const created = (await res.json()) as { id: string };
    toast.success(t('created'));
    router.push(`/programs/${created.id}?add=session`);
    router.refresh();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label htmlFor="name" className="sr-only">
            {t('programName')}
          </Label>
          <Input
            id="name"
            placeholder={t('programNamePlaceholder')}
            autoComplete="off"
            {...form.register('name')}
          />
          {form.formState.errors.name && (
            <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
          )}
        </div>
        <Button
          type="submit"
          className="h-10 shrink-0 sm:h-9"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? t('creating') : t('createProgram')}
        </Button>
      </div>

      <details className="group rounded-lg border border-dashed px-3 py-2 text-sm">
        <summary className="cursor-pointer select-none font-medium text-muted-foreground group-open:text-foreground">
          {t('advancedSettings')}
        </summary>
        <div className="mt-3 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="phase">{t('phase')}</Label>
            <Input id="phase" placeholder={t('phasePlaceholder')} {...form.register('phase')} />
            {form.formState.errors.phase && (
              <p className="text-sm text-destructive">{form.formState.errors.phase.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">{t('descriptionOptional')}</Label>
            <Textarea id="description" rows={2} {...form.register('description')} />
          </div>
        </div>
      </details>
    </form>
  );
}
