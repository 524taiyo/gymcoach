import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { ChatIcon, WorkoutIcon } from '@/components/icons';
import { getTranslations } from 'next-intl/server';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { getLlmProvider } from '@/lib/llm';
import { buildCoachPayload } from '@/lib/coach';
import { getProgramDefaults } from '@/lib/program-defaults';
import { summarizeCoachPayload } from '@/lib/coach-context';
import { CoachClient } from '@/components/coach/coach-client';
import { CoachContextCard } from '@/components/coach/coach-context-card';
import { CoachNoteCard } from '@/components/coach/coach-note-card';

export default async function CoachPage() {
  const t = await getTranslations('coach');
  const nav = await getTranslations('navigation');
  const auth = await requireSession();

  const [history, programDefaults, coachPayload] = await Promise.all([
    db.coachSession.findMany({
      where: { userId: auth.userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        weekStart: true,
        weekEnd: true,
        response: true,
        appliedAt: true,
        createdAt: true,
      },
    }),
    // Current prescription per exercise, to pre-fill the adjustments panel.
    getProgramDefaults(auth.userId),
    // "What your coach sees" (issue #154): the SAME builder the debrief and
    // chat routes use, so the card cannot drift from the payload the AI gets.
    buildCoachPayload(auth.userId),
  ]);

  const coachContext = summarizeCoachPayload(coachPayload);

  // Pre-serialize the dates for the client component.
  const initialHistory = history.map((h) => ({
    id: h.id,
    weekStart: h.weekStart.toISOString(),
    weekEnd: h.weekEnd.toISOString(),
    response: h.response,
    appliedAt: h.appliedAt?.toISOString() ?? null,
    createdAt: h.createdAt.toISOString(),
  }));

  const provider = getLlmProvider();
  const hasApiKey = provider.isConfigured();

  return (
    <main className="flex-1 px-4 py-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <PageHeader illustration="coach" title={t('title')} description={t('description')} />

        {/* /chat, /programs and /exercises lost their own tabs (three-tab
            bar). This row is their entry point on the coach side; home links
            to the same places for the paths used mid-week. */}
        <nav className="grid grid-cols-3 gap-2">
          {[
            { href: '/chat', label: nav('chat'), Icon: ChatIcon },
            { href: '/programs', label: nav('programs'), Icon: WorkoutIcon },
            { href: '/exercises', label: nav('catalog'), Icon: BookOpen },
          ].map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex min-h-tap flex-col items-center justify-center gap-1.5 rounded-card border border-border/80 bg-card p-3 text-xs font-medium shadow-card transition-colors hover:bg-accent/60"
            >
              <Icon className="size-5 text-primary-ink" />
              <span className="text-center leading-tight">{label}</span>
            </Link>
          ))}
        </nav>

        <CoachContextCard summary={coachContext} />

        <CoachNoteCard initialNote={coachPayload.userProfile.coachNote} />

        <CoachClient
          initialHistory={initialHistory}
          hasApiKey={hasApiKey}
          providerLabel={provider.label}
          apiKeyEnvVar={provider.apiKeyEnvVar}
          programDefaults={programDefaults}
        />
      </div>
    </main>
  );
}
