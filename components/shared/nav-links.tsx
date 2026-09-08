'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/', label: 'home' },
  { href: '/history', label: 'history' },
  { href: '/progress', label: 'progress' },
  { href: '/coach', label: 'coach' },
  { href: '/chat', label: 'chat' },
  { href: '/programs', label: 'programs' },
  { href: '/settings', label: 'settings' },
] as const;

export function NavLinks() {
  const pathname = usePathname();
  const t = useTranslations('navigation');
  return (
    <nav className="flex gap-1 overflow-x-auto border-t px-2 py-1.5">
      {LINKS.map((link) => {
        const active =
          link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            {t(link.label)}
          </Link>
        );
      })}
    </nav>
  );
}
