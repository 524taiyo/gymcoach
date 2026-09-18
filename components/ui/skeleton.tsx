import { cn } from '@/lib/utils';

// Placeholder block shown while a server component streams in. Deliberately
// plain: a pulsing surface in the muted tone, no shimmer gradient.
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  );
}

// Card-shaped placeholder, matching the real cards' radius and border so the
// swap to real content does not shift the layout.
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-card border border-border/80 bg-card p-5 shadow-card', className)}>
      <Skeleton className="h-3 w-32" />
      <Skeleton className="mt-3 h-6 w-2/3" />
      <Skeleton className="mt-2 h-3 w-24" />
    </div>
  );
}
