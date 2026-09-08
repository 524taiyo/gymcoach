import { Wand2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { getTranslations } from 'next-intl/server';
import { requireSession } from '@/lib/auth';
import { ProgramGenerator } from '@/components/programs/program-generator';

export default async function GenerateProgramPage() {
  const t = await getTranslations('programs');
  await requireSession();

  return (
    <main className="flex-1 px-4 py-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <PageHeader icon={Wand2} title={t('aiProgram')} />
        <ProgramGenerator />
      </div>
    </main>
  );
}
