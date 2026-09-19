import { parseGeneratedProgram, type GeneratedProgram } from '@/lib/schemas/program-generation';

// ============================================================
// A whole program proposed by the coach in the chat
// ============================================================
// The sibling of <adjustments>. That block retunes exercises the active
// program already has; this one carries an entire program - new split, new
// workouts, exercises the catalog may not contain yet - for the cases
// <adjustments> cannot express ("build me a 6-day upper/lower plan").
//
// The payload is the SAME shape the /programs/generate page produces and
// POST /api/programs/build accepts, validated by the same Zod schema, so the
// chat is not a second, looser way into program creation.

export const PROGRAM_TAG = 'program';

const PROGRAM_TAG_RE = /<program>([\s\S]*?)<\/program>/i;

export interface ExtractedProgram {
  // Markdown with the <program> block stripped out, ready to display.
  cleaned: string;
  // The validated program, or null when the block is absent or invalid.
  program: GeneratedProgram | null;
  // Validation failure surfaced for debugging (non-blocking): the prose stays
  // readable and the user simply gets no create button.
  parseError: string | null;
}

export function extractProgramProposal(markdown: string): ExtractedProgram {
  const match = markdown.match(PROGRAM_TAG_RE);
  if (!match) {
    return { cleaned: markdown.trim(), program: null, parseError: null };
  }
  const cleaned = markdown.replace(PROGRAM_TAG_RE, '').trim();
  const raw = match[1]?.trim();
  if (!raw) {
    return { cleaned, program: null, parseError: 'Empty <program> block.' };
  }

  // parseGeneratedProgram tolerates code fences and stray prose around the
  // JSON, which is exactly what a chat reply tends to wrap it in.
  const parsed = parseGeneratedProgram(raw);
  if (!parsed.ok) {
    return { cleaned, program: null, parseError: parsed.error };
  }
  return { cleaned, program: parsed.program, parseError: null };
}

// Total exercise rows in a proposal, for the "N workouts / M exercises" line.
export function countProgramExercises(program: GeneratedProgram): number {
  return program.workouts.reduce((total, w) => total + w.exercises.length, 0);
}
