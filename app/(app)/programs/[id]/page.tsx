import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { ProgramDetailView } from '@/components/programs/program-detail-view';
import { groupChangeBatches } from '@/lib/program-changes';

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

  const [exercisesCatalog, changeRows] = await Promise.all([
    db.exercise.findMany({
      where: { userId: session.userId },
      orderBy: [{ muscleGroup: 'asc' }, { name: 'asc' }],
    }),
    // Recent approved coach changes on this program, for the undo history.
    db.programChangeLog.findMany({
      where: { programId: program.id, userId: session.userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        batchId: true,
        source: true,
        action: true,
        exerciseName: true,
        workoutName: true,
        createdAt: true,
        undoneAt: true,
      },
    }),
  ]);

  return (
    <main className="flex-1 px-4 py-6">
      <ProgramDetailView
        program={program}
        catalog={exercisesCatalog}
        changeBatches={groupChangeBatches(changeRows)}
        openAddSession={searchParams.add === 'session'}
      />
    </main>
  );
}
