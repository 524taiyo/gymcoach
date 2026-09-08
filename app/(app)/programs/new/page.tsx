import Link from 'next/link';
import { ChevronLeft, ChevronRight, LayoutTemplate, Wand2 } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { requireSession } from '@/lib/auth';
import { PlusIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { ProgramCreateForm } from '@/components/programs/program-create-form';
import { TemplatePicker } from '@/components/programs/template-picker';
import { programTemplates } from '@/lib/programs/templates';

// One screen for every way to start a program: a template (one tap), the AI
// generator, or a blank program named by hand. Replaces the former
// new -> template two-step.
export default async function NewProgramPage() {
  const t = await getTranslations('programs');
  const common = await getTranslations('common');
  await requireSession();

  return (
    <main className="flex-1 px-4 py-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-5">
        <Button asChild variant="ghost" size="sm" className="-ml-2 self-start">
          <Link href="/programs">
            <ChevronLeft className="size-4" />
            <span className="ml-1">{common('actions.back')}</span>
          </Link>
        </Button>

        <PageHeader title={t('newProgram')} description={t('newProgramDescription')} />

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <PlusIcon className="size-4 text-primary-ink" />
              {t('optionManualTitle')}
            </CardTitle>
            <CardDescription>{t('optionManualDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ProgramCreateForm />
          </CardContent>
        </Card>

        <Link href="/programs/generate" className="block">
          <Card className="transition-colors hover:bg-accent/40">
            <CardContent className="flex items-center gap-3 p-4 sm:p-5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary-ink">
                <Wand2 className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold">{t('generateWithAi')}</p>
                <p className="text-sm text-muted-foreground">{t('optionAiDescription')}</p>
              </div>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <LayoutTemplate className="size-4 text-primary-ink" />
              {t('startFromTemplate')}
            </CardTitle>
            <CardDescription>{t('templateTeaser')}</CardDescription>
          </CardHeader>
          <CardContent>
            <TemplatePicker templates={programTemplates} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
