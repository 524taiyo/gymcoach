import { LoginForm } from '@/components/auth/login-form';
import { BrandMark } from '@/components/shared/brand-mark';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-4">
      <div className="flex flex-col items-center gap-3">
        <BrandMark size="lg" />
        <span className="text-2xl font-semibold tracking-tight">GymCoach</span>
      </div>
      <LoginForm />
    </main>
  );
}
