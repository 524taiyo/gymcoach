'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ProgramTemplate } from '@/lib/programs/templates';

interface Props {
  templates: ProgramTemplate[];
}

// Rows shown before "show all": enough to see the popular splits without
// pushing the other ways to start a program off the first screen.
const INITIAL_VISIBLE = 3;

// Compact "start from a template" list: one row per template, one tap to use.
// Materializes the template through /api/programs/from-template (same
// persistence as the AI generator) and makes it the active program.
export function TemplatePicker({ templates }: Props) {
  const t = useTranslations('programs');
  const router = useRouter();
  const [creatingSlug, setCreatingSlug] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(templates.length <= INITIAL_VISIBLE);
  const visible = showAll ? templates : templates.slice(0, INITIAL_VISIBLE);

  async function instantiate(template: ProgramTemplate) {
    setCreatingSlug(template.slug);
    try {
      const res = await fetch('/api/programs/from-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(template.program),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Error ${res.status}`);
      }
      const j = (await res.json()) as { id: string };
      toast.success(t('templateCreated'));
      router.push(`/programs/${j.id}`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('createError'));
      setCreatingSlug(null);
    }
  }

  return (
    <div className="flex flex-col divide-y divide-border rounded-lg border">
      {visible.map((template) => {
        const dayCount = template.program.workouts.length;
        const busy = creatingSlug === template.slug;
        return (
          <div key={template.slug} className="flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="text-sm font-semibold">{template.name}</p>
                <Badge variant="secondary">{t('dayCount', { count: dayCount })}</Badge>
              </div>
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                {template.summary}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-10 shrink-0 px-4"
              disabled={creatingSlug !== null}
              onClick={() => instantiate(template)}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : t('templateUseShort')}
            </Button>
          </div>
        );
      })}
      {!showAll && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="min-h-11 w-full px-3 text-sm font-medium text-primary hover:bg-accent/40"
        >
          {t('showAllTemplates', { count: templates.length })}
        </button>
      )}
      <p className="px-3 py-2 text-xs text-muted-foreground">{t('templateAttributionHint')}</p>
    </div>
  );
}
