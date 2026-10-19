-- Program block schedule (12-week recomp): optional length in weeks, planned
-- deload weeks and a session time budget. Additive and nullable/defaulted, so
-- existing programs are unaffected.
ALTER TABLE "Program" ADD COLUMN "durationWeeks" INTEGER;
ALTER TABLE "Program" ADD COLUMN "deloadWeeks" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
ALTER TABLE "Program" ADD COLUMN "sessionBudgetMin" INTEGER;
