import * as React from 'react';

// GymCoach icon set (source assets in /icon). Thin 1.75px strokes on a 24px
// grid so they sit next to the remaining lucide icons without a visible seam.
// Width and height default to 24px; Tailwind `size-*` classes override them.

export type IconProps = React.SVGProps<SVGSVGElement> & { size?: number };

export type IconComponent = React.ComponentType<React.SVGProps<SVGSVGElement>>;

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
});

export const HomeIcon = ({ size = 24, ...props }: IconProps) => (
  <svg {...base(size)} {...props}>
    <path d="M3.5 10.3 12 3.6l8.5 6.7V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19z" />
  </svg>
);

export const WorkoutIcon = ({ size = 24, ...props }: IconProps) => (
  <svg {...base(size)} {...props}>
    <path d="M8.8 12h6.4" />
    <rect x="5.2" y="7.2" width="3.6" height="9.6" rx="1.4" />
    <rect x="15.2" y="7.2" width="3.6" height="9.6" rx="1.4" />
    <path d="M2.8 9.6v4.8M21.2 9.6v4.8" />
  </svg>
);

export const HistoryIcon = ({ size = 24, ...props }: IconProps) => (
  <svg {...base(size)} {...props}>
    <circle cx="12" cy="12" r="8.4" />
    <path d="M12 7.2V12l3.4 2" />
  </svg>
);

export const StatsIcon = ({ size = 24, ...props }: IconProps) => (
  <svg {...base(size)} {...props}>
    <path d="M6 20v-6.5M12 20V5.5M18 20v-10" />
  </svg>
);

export const CoachIcon = ({ size = 24, ...props }: IconProps) => (
  <svg {...base(size)} {...props}>
    <path d="M20.5 12.2a7.5 7.5 0 0 1-10.9 6.7l-5.1 1.6 1.6-4.4A7.5 7.5 0 1 1 20.5 12.2z" />
  </svg>
);

// Same bubble as CoachIcon with a typing ellipsis, so the coach analysis page
// and the live chat page get distinct but related marks.
export const ChatIcon = ({ size = 24, ...props }: IconProps) => (
  <svg {...base(size)} {...props}>
    <path d="M20.5 12.2a7.5 7.5 0 0 1-10.9 6.7l-5.1 1.6 1.6-4.4A7.5 7.5 0 1 1 20.5 12.2z" />
    <path d="M9.2 12.2h.01M13 12.2h.01M16.8 12.2h.01" strokeWidth={2.4} />
  </svg>
);

export const SettingsIcon = ({ size = 24, ...props }: IconProps) => (
  <svg {...base(size)} {...props}>
    <path d="M4 7h8M17 7h3M4 12h3M12 12h8M4 17h8M17 17h3" />
    <circle cx="14.5" cy="7" r="2.1" />
    <circle cx="9.5" cy="12" r="2.1" />
    <circle cx="14.5" cy="17" r="2.1" />
  </svg>
);

export const PlusIcon = ({ size = 24, ...props }: IconProps) => (
  <svg {...base(size)} {...props}>
    <path d="M12 5.5v13M5.5 12h13" />
  </svg>
);

export const CloseIcon = ({ size = 24, ...props }: IconProps) => (
  <svg {...base(size)} {...props}>
    <path d="M6.2 6.2l11.6 11.6M17.8 6.2L6.2 17.8" />
  </svg>
);

export const MenuIcon = ({ size = 24, ...props }: IconProps) => (
  <svg {...base(size)} {...props}>
    <path d="M3.8 7h16.4M3.8 12h16.4M3.8 17h16.4" />
  </svg>
);

export const CalendarIcon = ({ size = 24, ...props }: IconProps) => (
  <svg {...base(size)} {...props}>
    <rect x="3.4" y="5.2" width="17.2" height="15.4" rx="2.6" />
    <path d="M8 3.2v4M16 3.2v4M3.4 10.2h17.2" />
  </svg>
);

export const TimerIcon = ({ size = 24, ...props }: IconProps) => (
  <svg {...base(size)} {...props}>
    <circle cx="12" cy="13.6" r="7.4" />
    <path d="M12 9.8v3.8M9.5 2.6h5" />
  </svg>
);

export const ProfileIcon = ({ size = 24, ...props }: IconProps) => (
  <svg {...base(size)} {...props}>
    <circle cx="12" cy="8.2" r="3.8" />
    <path d="M4.9 20.5c0-3.7 3.2-5.6 7.1-5.6s7.1 1.9 7.1 5.6" />
  </svg>
);
