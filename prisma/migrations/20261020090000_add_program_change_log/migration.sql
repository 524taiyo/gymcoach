-- Audit trail of approved coach program changes, grouped by batch for undo.
CREATE TABLE "ProgramChangeLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "exerciseName" TEXT NOT NULL,
    "workoutName" TEXT,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "undoneAt" TIMESTAMP(3),

    CONSTRAINT "ProgramChangeLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProgramChangeLog_userId_batchId_idx" ON "ProgramChangeLog"("userId", "batchId");

CREATE INDEX "ProgramChangeLog_programId_createdAt_idx" ON "ProgramChangeLog"("programId", "createdAt");

ALTER TABLE "ProgramChangeLog" ADD CONSTRAINT "ProgramChangeLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProgramChangeLog" ADD CONSTRAINT "ProgramChangeLog_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;
