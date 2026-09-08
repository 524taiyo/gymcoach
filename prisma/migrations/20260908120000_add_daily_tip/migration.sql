-- The coach's daily one-line greeting on the home page: cached per user, per
-- local day, per locale so the LLM runs at most once a day per language.
CREATE TABLE "DailyTip" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "modelUsed" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyTip_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DailyTip_userId_day_locale_key" ON "DailyTip"("userId", "day", "locale");

ALTER TABLE "DailyTip" ADD CONSTRAINT "DailyTip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
