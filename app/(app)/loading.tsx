import { SkeletonCard } from '@/components/ui/skeleton';

// Route-level fallback for every screen behind the tab bar. Without it a tab
// tap leaves the previous screen frozen until the server has finished its
// queries; with it the shell swaps immediately and the tab bar stays live.
export default function AppLoading() {
  return (
    <main className="flex-1 px-4 py-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </main>
  );
}
