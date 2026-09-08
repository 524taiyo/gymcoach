import { LanguageSelector } from '@/components/shared/language-selector';

// Layout for authentication routes: no navbar, fullscreen, with a soft brand
// wash behind the centered card.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-[radial-gradient(60%_50%_at_50%_0%,hsl(var(--primary)/0.10),transparent_70%)]">
      <div className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-10">
        <LanguageSelector showLabel />
      </div>
      {children}
    </div>
  );
}
