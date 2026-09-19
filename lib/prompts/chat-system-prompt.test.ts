import { describe, it, expect } from 'vitest';
import { CHAT_SYSTEM_PROMPT } from './chat-system-prompt';

// Issue #111: the in-session context guidance is INPUT-side only.
// The chat also carries ONE output contract - the <adjustments> block that
// lets a program change proposed in conversation be applied - and the guards
// on that contract are what this file pins down.

describe('chat system prompt', () => {
  it('tells the coach how to use the live currentSession section', () => {
    expect(CHAT_SYSTEM_PROMPT).toMatch(/currentSession/);
    expect(CHAT_SYSTEM_PROMPT).toMatch(/mid-workout/i);
    expect(CHAT_SYSTEM_PROMPT).toMatch(/immediately actionable/i);
    expect(CHAT_SYSTEM_PROMPT).toMatch(/staying within the user's program/i);
  });

  it('tells the coach how to use the plannedWorkout section', () => {
    expect(CHAT_SYSTEM_PROMPT).toMatch(/plannedWorkout/);
    expect(CHAT_SYSTEM_PROMPT).toMatch(/about to train/i);
  });

  it('defines the adjustments block as its only structured output', () => {
    expect(CHAT_SYSTEM_PROMPT).toContain('<adjustments>');
    expect(CHAT_SYSTEM_PROMPT).toContain('</adjustments>');
    // Every field the Zod schema requires must be named, or the block the
    // coach emits cannot pre-fill the apply form.
    for (const field of [
      'exerciseName',
      'summary',
      'rationale',
      'suggestedRepsMin',
      'suggestedRepsMax',
      'suggestedSets',
      'suggestedRIR',
      'suggestedRestSec',
    ]) {
      expect(CHAT_SYSTEM_PROMPT).toContain(field);
    }
    // No OTHER structured contract sneaks in alongside it.
    expect(CHAT_SYSTEM_PROMPT).not.toMatch(/SINGLE JSON object/i);
  });

  it('fences the block: existing exercises only, never mid-session, never self-applied', () => {
    // The apply route can only retune what is already in the program; the
    // prompt must not invite proposals it will silently skip.
    expect(CHAT_SYSTEM_PROMPT).toMatch(/ALREADY in the active program/i);
    expect(CHAT_SYSTEM_PROMPT).toMatch(/exerciseName EXACTLY/i);
    expect(CHAT_SYSTEM_PROMPT).toMatch(/[Nn]ever propose adding, removing or swapping/);
    // Mid-workout advice is about the next set, not a permanent edit.
    expect(CHAT_SYSTEM_PROMPT).toMatch(/Do NOT include the block when a currentSession/i);
    // The trainee confirms; the coach must not claim it already happened.
    expect(CHAT_SYSTEM_PROMPT).toMatch(/never applied on its own/i);
    expect(CHAT_SYSTEM_PROMPT).toMatch(/hypothetical/i);
  });

  it('defines the program block for what adjustments cannot express', () => {
    expect(CHAT_SYSTEM_PROMPT).toContain('<program>');
    expect(CHAT_SYSTEM_PROMPT).toContain('</program>');
    // The fields POST /api/programs/build validates must all be named.
    for (const field of [
      'workouts',
      'dayOfWeek',
      'muscleGroup',
      'category',
      'equipmentType',
      'targetSets',
      'restSec',
      'phase',
    ]) {
      expect(CHAT_SYSTEM_PROMPT).toContain(field);
    }
    // Reuse the catalog rather than growing duplicates of the same lift.
    expect(CHAT_SYSTEM_PROMPT).toMatch(/exerciseCatalog/);
    expect(CHAT_SYSTEM_PROMPT).toMatch(/Copy the name EXACTLY/i);
    // The two blocks stay apart, and neither fires mid-workout.
    expect(CHAT_SYSTEM_PROMPT).toMatch(/Never emit <program> and <adjustments> in the same reply/i);
    expect(CHAT_SYSTEM_PROMPT).toMatch(/Do NOT include the block when a currentSession/i);
    // Creating it is the trainee's tap.
    expect(CHAT_SYSTEM_PROMPT).toMatch(/Do not claim you have created anything/i);
  });
});
