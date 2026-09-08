import Image from 'next/image';
import { cn } from '@/lib/utils';

// Hand-drawn two-tone (navy + lime) illustrations from icon/アイコン, built
// into public/brand by scripts/build-brand-assets.mjs. They are decorative
// feature marks (page headers, empty states, cards), not action icons: the
// stroke icon set stays for buttons, nav and anything that needs currentColor.
export const ILLUSTRATIONS = {
  'add-set': 'Add set',
  calendar: 'Calendar',
  coach: 'Coach',
  complete: 'Complete',
  delete: 'Delete',
  edit: 'Edit',
  history: 'History',
  home: 'Home',
  logo: 'GymCoach',
  notes: 'Notes',
  notification: 'Notification',
  pr: 'Personal record',
  profile: 'Profile',
  program: 'Program',
  progress: 'Progress',
  recovery: 'Recovery',
  'rest-time': 'Rest time',
  search: 'Search',
  setting: 'Settings',
  stats: 'Stats',
  timer: 'Timer',
  workout: 'Workout',
} as const;

export type IllustrationName = keyof typeof ILLUSTRATIONS;

// The marks are navy on transparent, so they need the light brand ground
// behind them in dark mode. Every illustration therefore sits on its own
// off-white rounded tile (app-icon style) unless `plain` is passed.
const GROUND = 'bg-[#F7F8F5] ring-1 ring-inset ring-[#18212F]/10 dark:ring-white/15';

interface IllustrationProps {
  name: IllustrationName;
  // Rendered size in CSS pixels (square, tile included). Assets are 256px, so
  // anything up to 128px stays crisp on 2x screens.
  size?: number;
  className?: string;
  // Decorative by default (alt=""); pass a label when the image carries
  // meaning on its own, e.g. a PR mark without adjacent text.
  label?: string;
  priority?: boolean;
  // Skip the off-white tile (only for spots that already sit on a light ground).
  plain?: boolean;
}

export function Illustration({
  name,
  size = 40,
  className,
  label,
  priority,
  plain = false,
}: IllustrationProps) {
  const inner = plain ? size : Math.round(size * 0.78);
  const image = (
    <Image
      src={`/brand/${name}.png`}
      alt={label ?? ''}
      width={inner}
      height={inner}
      priority={priority}
      className={cn('shrink-0 select-none object-contain', plain && className)}
      draggable={false}
      unoptimized
    />
  );
  if (plain) return image;
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center', GROUND, className)}
      style={{ width: size, height: size, borderRadius: Math.max(6, Math.round(size * 0.24)) }}
    >
      {image}
    </span>
  );
}

// Larger framed variant used by page headers and cards: same off-white tile,
// with a soft shadow so it lifts off the page ground.
export function IllustrationTile({
  name,
  size = 44,
  className,
}: {
  name: IllustrationName;
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-xl shadow-xs',
        GROUND,
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Illustration name={name} size={Math.round(size * 0.7)} plain />
    </div>
  );
}
