'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { CoachIcon, HistoryIcon, HomeIcon, type IconComponent } from '@/components/icons';

// Three destinations, one per thing the app is for: train today, look back,
// ask the coach. Everything else is reached from inside one of them -
// /progress from the history tab, /programs, /exercises and /chat from home
// and the coach tab, /settings from the profile icon in the header.
//
// `matches` lists the route prefixes that keep a tab lit, so a sub-screen does
// not drop the highlight off the bar.
const LINKS = [
  { href: '/', label: 'today', icon: HomeIcon, matches: ['/session'] },
  { href: '/history', label: 'history', icon: HistoryIcon, matches: ['/progress'] },
  {
    href: '/coach',
    label: 'coach',
    icon: CoachIcon,
    matches: ['/chat', '/programs', '/exercises'],
  },
] as const satisfies ReadonlyArray<{
  href: string;
  label: string;
  icon: IconComponent;
  matches: ReadonlyArray<string>;
}>;

export function NavLinks() {
  const pathname = usePathname();
  const t = useTranslations('navigation');

  const isActive = (link: (typeof LINKS)[number]) => {
    if (link.href === '/' ? pathname === '/' : pathname.startsWith(link.href)) return true;
    return link.matches.some((prefix) => pathname.startsWith(prefix));
  };

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="mx-auto flex max-w-2xl">
        {LINKS.map((link) => {
          const active = isActive(link);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-0 pt-2 pb-1.5 text-[11px] font-medium leading-none tracking-tight transition-colors active:bg-accent/60',
                active ? 'text-primary-ink' : 'text-muted-foreground',
              )}
            >
              <span
                className={cn(
                  'flex size-8 items-center justify-center rounded-full transition-colors',
                  active && 'bg-primary/10',
                )}
              >
                <Icon className={cn('size-6', active && 'stroke-[2.1]')} />
              </span>
              <span className="w-full truncate text-center">{t(link.label)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
