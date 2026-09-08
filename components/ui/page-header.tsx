import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { IconComponent } from '@/components/icons';

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: IconComponent;
  // Right-aligned slot for the page's primary actions; wraps under the title
  // on phones so long localized button labels never overflow.
  actions?: ReactNode;
  className?: string;
}

// The one page-title pattern used across the app: tinted icon tile, title,
// optional one-line description, optional actions.
export function PageHeader({ title, description, icon: Icon, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3', className)}>
      <div className="flex min-w-0 items-center gap-3">
        {Icon && (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary-ink ring-1 ring-inset ring-primary/15">
            <Icon className="size-5" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex w-full gap-2 sm:w-auto">{actions}</div>}
    </div>
  );
}
