import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ApiError, handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';
import { getDailyTip } from '@/lib/daily-tip';
import { getLlmProvider, LlmError } from '@/lib/llm';
import { dailyTipDaySchema, dailyTipQuerySchema } from '@/lib/schemas/daily-tip';
import { defaultLocale, isLocale, localeCookieName, type Locale } from '@/i18n/config';

// Vercel: the first call of the day runs the LLM.
export const maxDuration = 60;

async function currentLocale(): Promise<Locale> {
  const requested = (await cookies()).get(localeCookieName)?.value;
  return isLocale(requested) ? requested : defaultLocale;
}

function parseDay(req: Request): string {
  const day = new URL(req.url).searchParams.get('day');
  const parsed = dailyTipQuerySchema.safeParse({ day });
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues[0]?.message ?? 'Invalid day');
  }
  return parsed.data.day;
}

// GET /api/coach/daily-tip?day=YYYY-MM-DD: today's one-liner, generated on
// first request and cached for the rest of the day. 204 when no LLM provider
// is configured so the card can stay hidden instead of showing an error.
export async function GET(req: Request) {
  try {
    const userId = await requireApiUserId();
    const day = parseDay(req);
    if (!getLlmProvider().isConfigured()) {
      return new NextResponse(null, { status: 204 });
    }
    const tip = await getDailyTip(userId, day, await currentLocale());
    return NextResponse.json(tip);
  } catch (err) {
    if (err instanceof LlmError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return handleApiError(err);
  }
}

// POST /api/coach/daily-tip { day }: regenerate today's line on demand.
export async function POST(req: Request) {
  try {
    const userId = await requireApiUserId();
    const { day } = await parseJsonBody(req, dailyTipQuerySchema.extend({ day: dailyTipDaySchema }));
    if (!getLlmProvider().isConfigured()) {
      return new NextResponse(null, { status: 204 });
    }
    const tip = await getDailyTip(userId, day, await currentLocale(), { force: true });
    return NextResponse.json(tip);
  } catch (err) {
    if (err instanceof LlmError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return handleApiError(err);
  }
}
