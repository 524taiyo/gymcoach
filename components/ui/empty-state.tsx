import Link from 'next/link';
import type { IconComponent } from '@/components/icons';
import { Illustration, type IllustrationName } from '@/components/brand/illustration';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon?: IconComponent;
  // A brand illustration, shown large; takes precedence over `icon`.
  illustration?: IllustrationName;
  title: string;
  description?: string;
  action?: { label: string; href: string };
  className?: string;
}

// Friendly placeholder shown when a page has no data yet. Keeps the Shadcn Card
// look and offers an optional call-to-action.
export function EmptyState({
  icon: Icon,
  illustration,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <Card className={cn(className)}>
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        {illustration ? (
          <Illustration name={illustration} size={72} className="mb-1" />
        ) : (
          Icon && (
            <div className="rounded-full bg-muted p-3 text-muted-foreground">
              <Icon className="size-6" />
            </div>
          )
        )}
        <div className="flex flex-col gap-1">
          <p className="text-base font-medium">{title}</p>
          {description && (
            <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {action && (
          <Button asChild className="mt-1 min-h-tap">
            <Link href={action.href}>{action.label}</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
