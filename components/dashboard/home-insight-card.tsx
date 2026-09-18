import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Illustration } from '@/components/brand/illustration';
import { getHomeInsight } from '@/lib/home-insight';

// Proactive coach insight (issue #237): the single highest-priority
// deterministic signal (recommended deload / stalled lift / fresh PR /
// on-track), composed from the existing derivations. Display-only, no LLM
// call; renders nothing on a brand-new account with no history.
//
// Its own component so home can stream it: the derivation reads the full set
// history and is the slowest thing on the page, and it sits below the fold.
// Blocking the "start today's workout" card on it was most of home's latency.
export async function HomeInsightCard({ userId }: { userId: string }) {
  const locale = await getLocale();
  const insight = await getHomeInsight(userId, new Date(), locale);
  if (!insight) return null;

  return (
    <Link href={insight.href} className="block">
      <Card className="border-primary/30 bg-primary/5 transition-colors hover:bg-primary/10">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Illustration name="notification" size={22} />
            {insight.title}
          </CardTitle>
          <CardDescription>{insight.detail}</CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}
