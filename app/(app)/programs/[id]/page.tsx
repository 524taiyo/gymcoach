import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { ProgramDetailView } from '@/components/programs/program-detail-view';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ add?: string }>;
}

export default async function ProgramDetailPage(props: Props) {
  const [params, searchParams] = await Promise.all([props.params, props.searchParams]);
  const session = await requireSession();

  const program = await db.program.findFirst({
    where: { id: params.id, userId: session.userId },
    include: {
      workouts: {
        orderBy: { order: 'asc' },
        include: {
          exercises: {
            orderBy: { order: 'asc' },
            include: { exercise: true },
          },
        },
      },
    },
  });

  if (!program) notFound();

  const exercisesCatalog = await db.exercise.findMany({
    where: { userId: session.userId },
    orderBy: [{ muscleGroup: 'asc' }, { name: 'asc' }],
  });

  return (
    <main className="flex-1 px-4 py-6">
      <ProgramDetailView
        program={program}
        catalog={exercisesCatalog}
        openAddSession={searchParams.add === 'session'}
      />
    </main>
  );
}
