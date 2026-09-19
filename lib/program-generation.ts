import { db } from '@/lib/db';
import { getLlmProvider, LlmError } from '@/lib/llm';
import { PROGRAM_GEN_SYSTEM_PROMPT } from '@/lib/prompts/program-system-prompt';
import { parseGeneratedProgram, type GeneratedProgram } from '@/lib/schemas/program-generation';
import { defaultIntraSetConfig } from '@/lib/intra-set-autoregulation';

// Generates a structured program draft from a natural-language goal. Does not
// persist anything: the result is previewed (and edited) before saving.
export async function generateProgram(userId: string, goal: string): Promise<GeneratedProgram> {
  const provider = getLlmProvider();

  const [user, exercises] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        sex: true,
        heightCm: true,
        bodyweight: true,
        goal: true,
        weeklyFrequency: true,
      },
    }),
    db.exercise.findMany({
      where: { userId },
      select: { name: true, muscleGroup: true, category: true, equipmentType: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const context = {
    profile: {
      sex: user?.sex ?? null,
      heightCm: user?.heightCm ?? null,
      bodyweight: user?.bodyweight ?? null,
      goal: user?.goal ?? null,
      weeklyFrequency: user?.weeklyFrequency ?? null,
    },
    availableExercises: exercises,
  };

  const userMessage = `User goal:\n${goal}\n\nContext (JSON):\n${JSON.stringify(context, null, 2)}`;

  const { text } = await provider.complete({
    system: PROGRAM_GEN_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
    maxTokens: 8000,
  });

  const parsed = parseGeneratedProgram(text);
  if (!parsed.ok) {
    throw new LlmError(502, `The generated program could not be parsed: ${parsed.error}`);
  }
  return parsed.program;
}

// Persists a (possibly user-edited) generated program in a single transaction.
// New exercises are created on the fly; existing ones are reused by name.
// Returns the new program id. The program is created inactive.
//
// Written as five batched statements rather than one per row: the row-by-row
// version issued a query per workout and three per exercise, and against a
// database a continent away (~100 ms each) a six-day plan blew through
// Prisma's 5 s interactive-transaction timeout (P2028) and rolled back.
export async function buildProgramFromGenerated(
  userId: string,
  program: GeneratedProgram,
): Promise<string> {
  return db.$transaction(
    async (tx) => {
      const created = await tx.program.create({
        data: {
          userId,
          name: program.name,
          description: program.description ?? null,
          phase: program.phase,
          isActive: false,
        },
      });

      const workouts = await tx.workout.createManyAndReturn({
        data: program.workouts.map((w, i) => ({
          programId: created.id,
          name: w.name,
          dayOfWeek: w.dayOfWeek ?? null,
          order: i + 1,
        })),
        select: { id: true, order: true },
      });
      // Match on `order` rather than trusting the returned row order: it is
      // unique within the program and is what we just assigned.
      const workoutIdByOrder = new Map(workouts.map((w) => [w.order, w.id]));

      // One lookup for every exercise the plan names, then one insert for the
      // ones the catalog does not have yet.
      const wanted = new Map<string, GeneratedProgram['workouts'][number]['exercises'][number]>();
      for (const w of program.workouts) {
        for (const ex of w.exercises) if (!wanted.has(ex.name)) wanted.set(ex.name, ex);
      }
      const existing = await tx.exercise.findMany({
        where: { userId, name: { in: [...wanted.keys()] } },
        select: { id: true, name: true, muscleGroup: true, category: true, usesBodyweight: true },
      });
      const byName = new Map(existing.map((e) => [e.name, e]));

      const missing = [...wanted.values()].filter((ex) => !byName.has(ex.name));
      if (missing.length > 0) {
        const inserted = await tx.exercise.createManyAndReturn({
          data: missing.map((ex) => ({
            userId,
            name: ex.name,
            muscleGroup: ex.muscleGroup,
            category: ex.category,
            equipmentType: ex.equipmentType ?? 'OTHER',
            defaultRestSec: ex.restSec,
          })),
          select: { id: true, name: true, muscleGroup: true, category: true, usesBodyweight: true },
        });
        for (const e of inserted) byName.set(e.name, e);
      }

      const rows = program.workouts.flatMap((w, wi) =>
        w.exercises.map((ex, ei) => {
          const exercise = byName.get(ex.name);
          if (!exercise) throw new Error(`Exercise not resolved: ${ex.name}`);
          const autoregDefaults = defaultIntraSetConfig(exercise);
          return {
            workoutId: workoutIdByOrder.get(wi + 1)!,
            exerciseId: exercise.id,
            order: ei + 1,
            targetSets: ex.targetSets,
            targetRepsMin: ex.targetRepsMin,
            targetRepsMax: Math.max(ex.targetRepsMax, ex.targetRepsMin),
            targetRIR: ex.targetRIR,
            restSec: ex.restSec,
            autoregulationMode: ex.autoregulationMode ?? ('PRESERVE_RIR' as const),
            fatigueRate: ex.fatigueRate ?? autoregDefaults.fatigueRate,
            loadAdjustmentPct: ex.loadAdjustmentPct ?? autoregDefaults.loadAdjustmentPct,
            tempo: ex.tempo ?? null,
            notes: ex.notes ?? null,
            supersetGroup: ex.supersetGroup ?? null,
          };
        }),
      );
      await tx.programExercise.createMany({ data: rows });

      return created.id;
    },
    // Headroom for a slow link; the batched version needs a fraction of it.
    { timeout: 20_000, maxWait: 10_000 },
  );
}
