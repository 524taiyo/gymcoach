'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, MessageSquarePlus, Send } from 'lucide-react';
import { WorkoutIcon } from '@/components/icons';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { extractAdjustments } from '@/lib/coach-adjustments';
import { stripStreamingBlocks } from '@/lib/coach-blocks';
import { extractProgramProposal } from '@/lib/coach-program';
import { CoachAdjustments } from './coach-adjustments';
import { ChatProgramProposal } from './chat-program-proposal';
import type { ProgramExerciseDefaults } from '@/lib/program-defaults';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
}

interface Props {
  initialConversations: ConversationSummary[];
  initialActiveId: string | null;
  initialMessages: ChatMessage[];
  // Live session attached from the session runner (issue #111), or null for a
  // normal chat. Sent with each message so the coach sees the workout so far.
  sessionId?: string | null;
  // Planned workout attached from home ("ask about this menu"), or null. Only
  // one of the two is ever set; the server drops it when a session is live.
  workoutId?: string | null;
  workoutName?: string | null;
  // Current prescription per exercise name, to pre-fill the apply panel when
  // the coach proposes program changes. Empty when there is no active program.
  programDefaults: Record<string, ProgramExerciseDefaults>;
  hasApiKey: boolean;
  providerLabel: string;
  apiKeyEnvVar: string;
}

export function ChatClient({
  initialConversations,
  initialActiveId,
  initialMessages,
  sessionId = null,
  workoutId = null,
  workoutName = null,
  programDefaults,
  hasApiKey,
  providerLabel,
  apiKeyEnvVar,
}: Props) {
  const t = useTranslations('coach.chat');
  const [conversations, setConversations] = useState(initialConversations);
  const [activeId, setActiveId] = useState<string | null>(initialActiveId);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  // Indexes of assistant messages whose proposal has been applied in this
  // view. A Message row has no "applied" column, so this is per-view state:
  // after a reload the panel offers to apply again (harmless - same values,
  // one more dated note line). The durable trail is ProgramExercise.notes.
  const [appliedAt, setAppliedAt] = useState<Record<number, string>>({});
  // Message index -> id of the program created from its proposal, so the
  // panel switches to "open it" instead of offering to create a second copy.
  const [createdPrograms, setCreatedPrograms] = useState<Record<number, string>>({});
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [messages]);

  function appendToAssistant(chunk: string) {
    setMessages((prev) => {
      const copy = [...prev];
      const last = copy[copy.length - 1];
      if (last && last.role === 'assistant') {
        copy[copy.length - 1] = { ...last, content: last.content + chunk };
      }
      return copy;
    });
  }

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;

    setInput('');
    setStreaming(true);
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: text },
      { role: 'assistant', content: '' },
    ]);

    try {
      const res = await fetch('/api/coach/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: activeId ?? undefined,
          message: text,
          sessionId: sessionId ?? undefined,
          workoutId: workoutId ?? undefined,
        }),
      });

      if (!res.ok || !res.body) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Error ${res.status}`);
      }

      const newId = res.headers.get('X-Conversation-Id');
      if (newId && newId !== activeId) {
        setActiveId(newId);
        if (!conversations.some((c) => c.id === newId)) {
          setConversations((prev) => [
            { id: newId, title: text.slice(0, 60), updatedAt: new Date().toISOString() },
            ...prev,
          ]);
        }
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        appendToAssistant(decoder.decode(value, { stream: true }));
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Chat failed.';
      toast.error(msg);
      appendToAssistant(`\n\n[error] ${msg}`);
    } finally {
      setStreaming(false);
    }
  }

  async function openConversation(id: string) {
    if (streaming) return;
    setActiveId(id);
    try {
      const res = await fetch(`/api/coach/chat/${id}`);
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const j = (await res.json()) as {
        messages: { role: 'USER' | 'ASSISTANT'; content: string }[];
      };
      setAppliedAt({});
      setCreatedPrograms({});
      setMessages(
        j.messages.map((m) => ({
          role: m.role === 'ASSISTANT' ? 'assistant' : 'user',
          content: m.content,
        })),
      );
    } catch {
      toast.error('Could not load that conversation.');
    }
  }

  function newConversation() {
    if (streaming) return;
    setActiveId(null);
    setMessages([]);
    setAppliedAt({});
    setCreatedPrograms({});
  }

  // Enter inserts a newline and never sends: on a phone keyboard Enter IS the
  // newline key, so binding it to submit made multi-line questions impossible
  // to type. Sending is the send button only.

  return (
    <div className="flex flex-col gap-4">
      {!hasApiKey && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
          <p className="font-medium text-amber-900 dark:text-amber-100">
            {providerLabel} key missing
          </p>
          <p className="text-xs text-muted-foreground">
            {t('apiKey', { variable: apiKeyEnvVar })}
          </p>
        </div>
      )}

      {sessionId && (
        <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
          <WorkoutIcon className="size-4 shrink-0 text-primary-ink" />
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{t('liveSession')}</span>{' '}
            {t('liveSessionDescription')}
          </p>
        </div>
      )}

      {!sessionId && workoutId && (
        <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
          <WorkoutIcon className="size-4 shrink-0 text-primary-ink" />
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              {t('plannedWorkout', { name: workoutName ?? '' })}
            </span>{' '}
            {t('plannedWorkoutDescription')}
          </p>
        </div>
      )}

      <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={newConversation}
          className="h-10 shrink-0 sm:h-8"
        >
          <MessageSquarePlus className="size-4" />
          <span className="ml-1.5">{t('new')}</span>
        </Button>
        {conversations.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => openConversation(c.id)}
            className={cn(
              'max-w-[12rem] shrink-0 truncate rounded-full border px-3 py-2.5 text-xs transition-colors sm:py-1.5',
              c.id === activeId
                ? 'border-primary/40 bg-primary/10 text-foreground'
                : 'border-border text-muted-foreground hover:bg-accent/40',
            )}
          >
            {c.title}
          </button>
        ))}
      </div>

      <div
        ref={threadRef}
        className="flex min-h-[40vh] flex-col gap-3 overflow-y-auto rounded-lg border p-3"
      >
        {messages.length === 0 ? (
          <p className="m-auto max-w-sm text-center text-sm text-muted-foreground">
            {sessionId
              ? t('emptySession')
              : workoutId
                ? t('emptyPlannedWorkout')
                : t('empty')}
          </p>
        ) : (
          messages.map((m, i) => {
            const isAssistant = m.role === 'assistant';
            const stillStreaming = streaming && isAssistant && i === messages.length - 1;
            // The <adjustments> block is machine-readable duplication of what
            // the prose already says, and it arrives character by character:
            // never show it, streaming or not.
            const text = isAssistant ? stripStreamingBlocks(m.content) : m.content;
            // Program changes are offered once the reply is complete. Never
            // mid-workout: an in-session answer is about the next set, not a
            // permanent edit (the prompt says so too, this enforces it).
            const canApply = isAssistant && !stillStreaming && !sessionId;
            const proposal = canApply ? extractAdjustments(m.content).adjustments : [];
            // A whole new program, for what <adjustments> cannot express.
            const programProposal = canApply ? extractProgramProposal(m.content).program : null;
            return (
              <Fragment key={i}>
                <div
                  className={cn(
                    'min-w-0 max-w-[90%] rounded-lg px-3 py-2 text-sm sm:max-w-[85%]',
                    m.role === 'user'
                      ? 'self-end bg-primary-strong text-primary-foreground'
                      : 'self-start bg-muted',
                  )}
                >
                  {isAssistant ? (
                    text === '' && streaming ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <article className="prose prose-sm dark:prose-invert max-w-none break-words [&_pre]:overflow-x-auto [&_table]:block [&_table]:overflow-x-auto">
                        <ReactMarkdown>{text}</ReactMarkdown>
                      </article>
                    )
                  ) : (
                    <span className="whitespace-pre-wrap">{m.content}</span>
                  )}
                </div>
                {programProposal && (
                  <div className="w-full">
                    <ChatProgramProposal
                      program={programProposal}
                      createdId={createdPrograms[i] ?? null}
                      onCreated={(id) => setCreatedPrograms((prev) => ({ ...prev, [i]: id }))}
                    />
                  </div>
                )}
                {proposal.length > 0 && activeId && (
                  <div className="w-full">
                    <CoachAdjustments
                      applyUrl={`/api/coach/chat/${activeId}/apply`}
                      initialAdjustments={proposal}
                      programDefaults={programDefaults}
                      alreadyApplied={appliedAt[i] != null}
                      onApplied={(at) => setAppliedAt((prev) => ({ ...prev, [i]: at }))}
                      title={t('applyToProgram')}
                    />
                  </div>
                )}
              </Fragment>
            );
          })
        )}
      </div>

      <div className="flex items-end gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={2}
          placeholder={t('placeholder')}
          aria-label={t('placeholder')}
          disabled={!hasApiKey || streaming}
          className="resize-none"
        />
        <Button
          type="button"
          onClick={send}
          disabled={!hasApiKey || streaming || input.trim() === ''}
          className="min-h-tap"
          aria-label={t('send')}
        >
          {streaming ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
