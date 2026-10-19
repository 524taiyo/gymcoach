import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ApiError, handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';
import { applyAdjustmentsSchema } from '@/lib/coach-adjustments';
import { applyAdjustmentsToActiveProgram } from '@/lib/coach-apply';

interface Params {
  params: Promise<{ id: string }>;
}

// POST /api/coach/chat/[id]/apply
// The chat counterpart of /api/coach/[id]/apply: applies the adjustments the
// coach proposed inside a conversation to the active program. [id] is the
// conversation. Same contract as the debrief route - the body is re-validated
// with Zod and the write only ever touches the user's active program - so the
// chat is not a wider door into the program than the weekly debrief is.
//
// There is no per-message "applied" flag to set (a Message has no such
// column); the audit trail is ProgramChangeLog (undoable by batchId) plus the
// dated line an update appends to ProgramExercise.notes.
export async function POST(req: Request, props: Params) {
  const params = await props.params;
  try {
    const userId = await requireApiUserId();
    const { adjustments } = await parseJsonBody(req, applyAdjustmentsSchema);

    // Scoped read: ownership is part of the query.
    const conversation = await db.conversation.findFirst({
      where: { id: params.id, userId },
      select: { id: true },
    });
    if (!conversation) {
      throw new ApiError(404, 'Conversation not found.');
    }

    const { applied, skipped, batchId } = await applyAdjustmentsToActiveProgram(
      userId,
      adjustments,
      new Date(),
      'chat',
    );

    return NextResponse.json({
      ok: true,
      appliedAt: new Date().toISOString(),
      applied,
      skipped,
      batchId,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
