import { Dumbbell } from 'lucide-react';
import { LogoutButton } from '@/components/auth/logout-button';
import { NavLinks } from '@/components/shared/nav-links';
import { OfflineIndicator } from '@/components/shared/offline-indicator';
import { SyncBootstrap } from '@/components/shared/sync-bootstrap';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import { LanguageSelector } from '@/components/shared/language-selector';
import Link from 'next/link';

// Layout for protected routes (post-login).
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SyncBootstrap />
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <Dumbbell className="size-4 opacity-80" />
            <span className="text-sm font-semibold tracking-tight">GymCoach</span>
          </Link>
          <div className="flex items-center gap-2">
            <OfflineIndicator />
            <LanguageSelector />
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>
        <NavLinks />
      </header>
      {children}
    </div>
  );
}
