import { z } from 'zod';
import { ExerciseCategory, MuscleGroup } from '@/lib/prisma-client';

// ============================================================
// Adjustments proposed by the coach (BATCH 10)
// ============================================================
// The system prompt asks Claude to emit an <adjustments> XML block
// containing a JSON array at the end of each debrief. We extract, validate
// (Zod) and expose the result to the UI without touching the displayed markdown.

// What an adjustment does to the active program. 'update' (the default, and
// the only kind before structural changes existed) retunes an exercise that is
// already there; 'add', 'remove' and 'move' change the structure of ONE
// workout. Every kind is applied only after the user approves it, is logged,
// and can be undone (lib/program-changes.ts).
export const ADJUSTMENT_ACTIONS = ['update', 'add', 'remove', 'move'] as const;
export type AdjustmentAction = (typeof ADJUSTMENT_ACTIONS)[number];

export const adjustmentSchema = z
  .object({
    action: z.enum(ADJUSTMENT_ACTIONS).optional(),
    exerciseName: z.string().trim().min(1).max(120),
    // Workout the change targets, matched exactly by name. Required for add
    // and move; for update/remove it narrows an exercise that appears in
    // several workouts.
    workoutName: z.string().trim().min(1).max(120).optional().nullable(),
    // 1-based position inside the workout (add: where to insert, default at
    // the end; move: required destination).
    position: z.number().int().min(1).max(30).optional().nullable(),
    // Only used by 'add' when the exercise is not in the user's catalog yet.
    muscleGroup: z.nativeEnum(MuscleGroup).optional().nullable(),
    category: z.nativeEnum(ExerciseCategory).optional().nullable(),
    summary: z.string().trim().min(1).max(300),
    rationale: z.string().trim().max(800).optional().nullable(),
    suggestedRepsMin: z.number().int().min(1).max(50).optional().nullable(),
    suggestedRepsMax: z.number().int().min(1).max(50).optional().nullable(),
    suggestedSets: z.number().int().min(1).max(20).optional().nullable(),
    suggestedRIR: z.number().int().min(0).max(5).optional().nullable(),
    suggestedRestSec: z.number().int().min(15).max(600).optional().nullable(),
    currentLoad: z.number().min(0).max(1000).optional().nullable(),
    suggestedLoad: z.number().min(0).max(1000).optional().nullable(),
    note: z.string().trim().max(500).optional().nullable(),
  })
  .superRefine((a, ctx) => {
    const action = a.action ?? 'update';
    if ((action === 'add' || action === 'move') && !a.workoutName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `A ${action} needs the target workoutName.`,
        path: ['workoutName'],
      });
    }
    if (action === 'move' && a.position == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A move needs the destination position.',
        path: ['position'],
      });
    }
    if (action === 'add') {
      const missing = (
        [
          'suggestedSets',
          'suggestedRepsMin',
          'suggestedRepsMax',
          'suggestedRIR',
          'suggestedRestSec',
        ] as const
      ).filter((k) => a[k] == null);
      if (missing.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `An add needs the full prescription (${missing.join(', ')}).`,
          path: [missing[0]!],
        });
      }
    }
  });

export type Adjustment = z.infer<typeof adjustmentSchema>;

export const ADJUSTMENTS_TAG = 'adjustments';

const ADJUSTMENTS_TAG_RE = /<adjustments>([\s\S]*?)<\/adjustments>/i;

export interface ExtractedAdjustments {
  // Markdown with the <adjustments> block stripped out (ready to display as-is).
  cleaned: string;
  // Array of validated adjustments. Empty if the block is missing or invalid.
  adjustments: Adjustment[];
  // Parsing errors surfaced for debugging (non-blocking).
  parseErrors: string[];
}

// Extracts and parses the <adjustments>...</adjustments> block from a coach response.
// Returns the cleaned markdown + the valid adjustments. On a JSON parsing or schema
// error, we just return an empty array and the error in parseErrors (the markdown
// stays displayable).
export function extractAdjustments(markdown: string): ExtractedAdjustments {
  const match = markdown.match(ADJUSTMENTS_TAG_RE);
  if (!match) {
    return { cleaned: markdown.trim(), adjustments: [], parseErrors: [] };
  }
  const cleaned = markdown.replace(ADJUSTMENTS_TAG_RE, '').trim();
  const raw = match[1]?.trim();
  if (!raw) {
    return { cleaned, adjustments: [], parseErrors: ['Empty <adjustments> block.'] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return {
      cleaned,
      adjustments: [],
      parseErrors: [
        `Invalid JSON in <adjustments>: ${err instanceof Error ? err.message : 'unknown error'}`,
      ],
    };
  }

  const result = z.array(adjustmentSchema).safeParse(parsed);
  if (!result.success) {
    return {
      cleaned,
      adjustments: [],
      parseErrors: [
        `Invalid schema: ${result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' ; ')}`,
      ],
    };
  }
  return { cleaned, adjustments: result.data, parseErrors: [] };
}

// ============================================================
// Schema for the POST /api/coach/[id]/apply request
// ============================================================
// The client sends the list of validated adjustments (possibly edited
// by the user). We re-validate server-side via Zod.

export const applyAdjustmentsSchema = z.object({
  adjustments: z.array(adjustmentSchema).min(1, 'No adjustment to apply.'),
});

export type ApplyAdjustmentsInput = z.infer<typeof applyAdjustmentsSchema>;
