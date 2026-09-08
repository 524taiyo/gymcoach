import { WorkoutIcon } from '@/components/icons';
import { cn } from '@/lib/utils';

interface BrandMarkProps {
  // Tile size in Tailwind spacing units: 'sm' for the header, 'lg' for auth.
  size?: 'sm' | 'lg';
  className?: string;
}

// The GymCoach logo tile: navy dumbbell on a lime rounded square.
export function BrandMark({ size = 'sm', className }: BrandMarkProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-[inset_0_-1px_0_rgba(0,0,0,0.15),0_1px_2px_rgba(24,33,47,0.22)]',
        size === 'sm' ? 'size-7 rounded-lg' : 'size-12 rounded-2xl',
        className,
      )}
    >
      <WorkoutIcon className={size === 'sm' ? 'size-4' : 'size-7'} strokeWidth={2} />
    </span>
  );
}
