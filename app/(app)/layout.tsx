import { LogoutButton } from '@/components/auth/logout-button';
import { HeaderOffset } from '@/components/shared/header-offset';
import { NavLinks } from '@/components/shared/nav-links';
import { OfflineIndicator } from '@/components/shared/offline-indicator';
import { QuickTimer } from '@/components/shared/quick-timer';
import { SyncBootstrap } from '@/components/shared/sync-bootstrap';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import { LanguageSelector } from '@/components/shared/language-selector';
import { BrandMark } from '@/components/shared/brand-mark';
import Link from 'next/link';

// Layout for protected routes (post-login). Phones get a fixed bottom tab bar
// (thumb reach); md and up keep the pill row under the header.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SyncBootstrap />
      <header className="sticky top-0 z-10 border-b bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <HeaderOffset />
        <div className="flex items-center justify-between px-3 py-2 sm:px-4 sm:py-3">
          <Link href="/" className="flex min-h-11 items-center gap-2.5 pl-1">
            <BrandMark />
            <span className="text-[15px] font-semibold tracking-tight">GymCoach</span>
          </Link>
          <div className="flex items-center gap-0.5 sm:gap-2">
            <OfflineIndicator />
            <QuickTimer />
            <LanguageSelector />
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>
        <NavLinks variant="top" />
      </header>
      <div className="flex flex-1 flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
        {children}
      </div>
      <NavLinks variant="bottom" />
    </div>
  );
}
