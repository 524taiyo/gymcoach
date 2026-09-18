import Link from 'next/link';
import { cn } from '@/lib/utils';

export interface SectionTab {
  href: string;
  label: string;
}

// Segmented control for screens that share a bottom tab but are separate
// routes (history / progress). Server component on purpose: the caller already
// knows which one it is, so there is no client state to hold.
export function SectionTabs({
  tabs,
  current,
  className,
}: {
  tabs: SectionTab[];
  // href of the tab being displayed.
  current: string;
  className?: string;
}) {
  return (
    <nav className={cn('flex gap-1 rounded-full bg-muted p-1', className)}>
      {tabs.map((tab) => {
        const active = tab.href === current;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex min-h-10 flex-1 items-center justify-center rounded-full px-3 text-sm font-medium transition-colors',
              active
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
