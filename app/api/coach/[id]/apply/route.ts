import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ApiError, handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';
import { applyAdjustmentsSchema } from '@/lib/coach-adjustments';
import { applyAdjustmentsToActiveProgram } from '@/lib/coach-apply';

interface Params {
  params: Promise<{ id: string }>;
}

// POST /api/coach/[id]/apply
// Applies the adjustments validated by the user to the active program (see
// lib/coach-apply.ts for the write itself, shared with the chat apply route)
// and marks the `CoachSession` as applied (`appliedAt`).
export async function POST(req: Request, props: Params) {
  const params = await props.params;
  try {
    const userId = await requireApiUserId();
    const { adjustments } = await parseJsonBody(req, applyAdjustmentsSchema);

    // Scoped read (issue #317): ownership is part of the query, not a
    // separate comparison that a later edit could drop.
    const coachSession = await db.coachSession.findFirst({
      where: { id: params.id, userId },
    });
    if (!coachSession) {
      throw new ApiError(404, 'Debrief not found.');
    }

    const { applied, skipped, batchId } = await applyAdjustmentsToActiveProgram(
      userId,
      adjustments,
      new Date(),
      'debrief',
    );

    // The write carries userId too (issue #317): marking a debrief applied
    // stays scoped even if the ownership check above is ever removed.
    const updated = await db.coachSession.update({
      where: { id: params.id, userId },
      data: { appliedAt: new Date() },
    });

    return NextResponse.json({
      ok: true,
      appliedAt: updated.appliedAt,
      applied,
      skipped,
      batchId,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
