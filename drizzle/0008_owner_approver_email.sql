ALTER TABLE "plantation_programs"
ADD COLUMN "owner_approver_email" text;--> statement-breakpoint

UPDATE "plantation_programs"
SET "owner_approver_email" = 'demo@plantsure.feedbacknfc.com'
WHERE "is_demo" = true
  AND "owner_approver_email" IS NULL;--> statement-breakpoint
