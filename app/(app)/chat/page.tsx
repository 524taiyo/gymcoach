import { ChatIcon } from '@/components/icons';
import { PageHeader } from '@/components/ui/page-header';
import { getLocale, getTranslations } from 'next-intl/server';
import { getTrainingDisplayName } from '@/i18n/training-names';
import { requireSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { getLlmProvider } from '@/lib/llm';
import {
  ChatClient,
  type ChatMessage,
  type ConversationSummary,
} from '@/components/coach/chat-client';

interface SearchParams {
  sessionId?: string;
  workoutId?: string;
}

export default async function ChatPage(
  props: {
    searchParams: Promise<SearchParams>;
  }
) {
  const t = await getTranslations('coach');
  const locale = await getLocale();
  const searchParams = await props.searchParams;
  const auth = await requireSession();

  // In-session chat (issue #111): the session runner links here with
  // ?sessionId=... . Only forward an id that belongs to the caller; anything
  // else degrades to a normal chat (the API re-checks ownership anyway).
  let sessionId: string | null = null;
  if (searchParams.sessionId) {
    const owned = await db.session.findFirst({
      where: { id: searchParams.sessionId, userId: auth.userId },
      select: { id: true },
    });
    sessionId = owned?.id ?? null;
  }

  // Pre-session chat: home links here with ?workoutId=... to talk about a
  // workout that has not started yet. Ownership goes through the program
  // relation, and the same rule applies - a foreign or unknown id degrades to
  // a normal chat rather than erroring. A live session takes precedence.
  let workoutId: string | null = null;
  let workoutName: string | null = null;
  if (!sessionId && searchParams.workoutId) {
    const owned = await db.workout.findFirst({
      where: { id: searchParams.workoutId, program: { userId: auth.userId } },
      select: { id: true, name: true },
    });
    workoutId = owned?.id ?? null;
    workoutName = owned ? getTrainingDisplayName(owned.name, locale) : null;
  }

  const conversations = await db.conversation.findMany({
    where: { userId: auth.userId },
    orderBy: { updatedAt: 'desc' },
    take: 50,
    select: { id: true, title: true, updatedAt: true },
  });

  // With a workout attached - live or planned - start on a fresh conversation
  // so the question about it is not appended to an old thread.
  const active = sessionId || workoutId ? null : (conversations[0] ?? null);
  let initialMessages: ChatMessage[] = [];
  if (active) {
    const msgs = await db.message.findMany({
      where: { conversationId: active.id },
      orderBy: { createdAt: 'asc' },
      select: { role: true, content: true },
    });
    initialMessages = msgs.map((m) => ({
      role: m.role === 'ASSISTANT' ? 'assistant' : 'user',
      content: m.content,
    }));
  }

  const initialConversations: ConversationSummary[] = conversations.map((c) => ({
    id: c.id,
    title: c.title ?? t('conversation'),
    updatedAt: c.updatedAt.toISOString(),
  }));

  const provider = getLlmProvider();

  return (
    <main className="flex-1 px-4 py-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <PageHeader icon={ChatIcon} title={t('chatTitle')} description={t('chatDescription')} />

        <ChatClient
          initialConversations={initialConversations}
          initialActiveId={active?.id ?? null}
          initialMessages={initialMessages}
          sessionId={sessionId}
          workoutId={workoutId}
          workoutName={workoutName}
          hasApiKey={provider.isConfigured()}
          providerLabel={provider.label}
          apiKeyEnvVar={provider.apiKeyEnvVar}
        />
      </div>
    </main>
  );
}
