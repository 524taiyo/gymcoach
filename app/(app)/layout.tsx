import { LogoutButton } from '@/components/auth/logout-button';
import { HeaderOffset } from '@/components/shared/header-offset';
import { NavLinks } from '@/components/shared/nav-links';
import { OfflineIndicator } from '@/components/shared/offline-indicator';
import { QuickTimer } from '@/components/shared/quick-timer';
import { SyncBootstrap } from '@/components/shared/sync-bootstrap';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import { LanguageSelector } from '@/components/shared/language-selector';
import { BrandMark } from '@/components/shared/brand-mark';
import { ProfileIcon } from '@/components/icons';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

// Layout for protected routes (post-login). One fixed bottom tab bar at every
// width (thumb reach on the phone this is used on), and the header carries the
// profile icon that leads to /settings.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('navigation');

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
            <Link
              href="/settings"
              aria-label={t('settings')}
              title={t('settings')}
              className="inline-flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <ProfileIcon className="size-5" />
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>
      <div className="flex flex-1 flex-col pb-[calc(5rem+env(safe-area-inset-bottom))]">
        {children}
      </div>
      <NavLinks />
    </div>
  );
}
