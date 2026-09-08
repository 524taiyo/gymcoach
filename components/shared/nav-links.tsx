'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import {
  ChatIcon,
  CoachIcon,
  HistoryIcon,
  HomeIcon,
  SettingsIcon,
  StatsIcon,
  WorkoutIcon,
  type IconComponent,
} from '@/components/icons';

const LINKS = [
  { href: '/', label: 'home', icon: HomeIcon },
  { href: '/history', label: 'history', icon: HistoryIcon },
  { href: '/progress', label: 'progress', icon: StatsIcon },
  { href: '/coach', label: 'coach', icon: CoachIcon },
  { href: '/chat', label: 'chat', icon: ChatIcon },
  { href: '/programs', label: 'programs', icon: WorkoutIcon },
  { href: '/settings', label: 'settings', icon: SettingsIcon },
] as const satisfies ReadonlyArray<{ href: string; label: string; icon: IconComponent }>;

interface NavLinksProps {
  // "top": pill row under the header, desktop only (md and up).
  // "bottom": fixed tab bar with icons, phones only (below md).
  variant: 'top' | 'bottom';
}

export function NavLinks({ variant }: NavLinksProps) {
  const pathname = usePathname();
  const t = useTranslations('navigation');

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  if (variant === 'bottom') {
    return (
      <nav
        className="fixed inset-x-0 bottom-0 z-20 flex border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/85 md:hidden"
      >
        {LINKS.map((link) => {
          const active = isActive(link.href);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-0 pt-2 pb-1.5 text-[10px] font-medium leading-none tracking-tight transition-colors active:bg-accent/60',
                active ? 'text-primary-ink' : 'text-muted-foreground',
              )}
            >
              <span
                className={cn(
                  'flex size-7 items-center justify-center rounded-full transition-colors',
                  active && 'bg-primary/10',
                )}
              >
                <Icon className={cn('size-5', active && 'stroke-[2.1]')} />
              </span>
              <span className="w-full truncate text-center">{t(link.label)}</span>
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="hidden gap-1 overflow-x-auto border-t px-2 py-1.5 md:flex">
      {LINKS.map((link) => {
        const active = isActive(link.href);
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            <Icon className="size-4" />
            {t(link.label)}
          </Link>
        );
      })}
    </nav>
  );
}
