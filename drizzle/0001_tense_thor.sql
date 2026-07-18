CREATE TYPE "public"."plantation_member_role" AS ENUM('admin', 'auditor');--> statement-breakpoint
CREATE TABLE "plantation_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"email" text,
	"display_name" text,
	"role" "plantation_member_role" DEFAULT 'admin' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plantation_members_clerk_user_id_unique" UNIQUE("clerk_user_id")
);
--> statement-breakpoint
CREATE INDEX "plantation_members_clerk_user_id_idx" ON "plantation_members" USING btree ("clerk_user_id");--> statement-breakpoint
INSERT INTO "plantation_members" (
	"id",
	"clerk_user_id",
	"email",
	"display_name",
	"role"
) VALUES (
	'00000000-0000-4000-8000-000000000020',
	'legacy:phase1-admin',
	'ml@feedbacknfc.com',
	'Phase 1 Admin',
	'admin'
) ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
ALTER TABLE "plantation_audit_windows" ADD CONSTRAINT "plantation_audit_windows_assigned_member_id_plantation_members_id_fk" FOREIGN KEY ("assigned_member_id") REFERENCES "public"."plantation_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plantation_audit_windows" ADD CONSTRAINT "plantation_audit_windows_waived_by_plantation_members_id_fk" FOREIGN KEY ("waived_by") REFERENCES "public"."plantation_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plantation_audits" ADD CONSTRAINT "plantation_audits_auditor_member_id_plantation_members_id_fk" FOREIGN KEY ("auditor_member_id") REFERENCES "public"."plantation_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plantation_boards" ADD CONSTRAINT "plantation_boards_generated_by_plantation_members_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."plantation_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plantation_boards" ADD CONSTRAINT "plantation_boards_installed_by_plantation_members_id_fk" FOREIGN KEY ("installed_by") REFERENCES "public"."plantation_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plantation_sites" ADD CONSTRAINT "plantation_sites_created_by_member_id_plantation_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."plantation_members"("id") ON DELETE restrict ON UPDATE no action;
