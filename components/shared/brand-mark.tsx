import Image from 'next/image';
import { cn } from '@/lib/utils';

interface BrandMarkProps {
  // 'sm' for the header, 'lg' for the auth screens.
  size?: 'sm' | 'lg';
  className?: string;
}

// The GymCoach app tile as drawn in icon/アイコン (lime dumbbell + play mark on
// an off-white rounded square), built to public/brand/logo-tile.png.
export function BrandMark({ size = 'sm', className }: BrandMarkProps) {
  const px = size === 'sm' ? 28 : 64;
  return (
    <Image
      src="/brand/logo-tile.png"
      alt=""
      width={px}
      height={px}
      priority
      aria-hidden="true"
      draggable={false}
      unoptimized
      className={cn(
        'shrink-0 select-none ring-1 ring-inset ring-border/60',
        size === 'sm' ? 'rounded-lg' : 'rounded-2xl shadow-card',
        className,
      )}
    />
  );
}
