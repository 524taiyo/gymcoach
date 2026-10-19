import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiError, handleApiError, requireApiUserId } from '@/lib/api';
import { undoProgramChangeBatch } from '@/lib/coach-apply';

interface Params {
  params: Promise<{ batchId: string }>;
}

const batchIdSchema = z.string().trim().min(1).max(100);

// POST /api/program-changes/[batchId]/undo
// Reverts one batch of approved coach changes (lib/coach-apply.ts). Every read
// and write is scoped to the authenticated user; only the latest batch of a
// program can be undone (409 otherwise).
export async function POST(_req: Request, props: Params) {
  const params = await props.params;
  try {
    const userId = await requireApiUserId();
    const parsed = batchIdSchema.safeParse(params.batchId);
    if (!parsed.success) throw new ApiError(400, 'Invalid batch id.');
    const result = await undoProgramChangeBatch(userId, parsed.data);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return handleApiError(err);
  }
}
