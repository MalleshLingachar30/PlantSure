CREATE TABLE "plantation_audit_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "site_id" uuid NOT NULL,
  "window_id" uuid NOT NULL,
  "site_auditor_id" uuid NOT NULL,
  "auditor_email" text NOT NULL,
  "assigned_by_member_id" uuid NOT NULL,
  "accepted_by_member_id" uuid,
  "status" text DEFAULT 'assigned' NOT NULL,
  "assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
  "accepted_at" timestamp with time zone,
  "submitted_at" timestamp with time zone,
  "cancelled_at" timestamp with time zone,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "plantation_audit_assignments_status_check"
    CHECK ("status" IN ('assigned', 'accepted', 'submitted', 'cancelled')),
  CONSTRAINT "plantation_audit_assignments_auditor_email_not_blank_check"
    CHECK (length(btrim("auditor_email")) > 0)
);--> statement-breakpoint

ALTER TABLE "plantation_audit_assignments"
ADD CONSTRAINT "plantation_audit_assignments_site_id_plantation_sites_id_fk"
FOREIGN KEY ("site_id") REFERENCES "public"."plantation_sites"("id")
ON DELETE restrict ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "plantation_audit_assignments"
ADD CONSTRAINT "plantation_audit_assignments_window_id_plantation_audit_windows_id_fk"
FOREIGN KEY ("window_id") REFERENCES "public"."plantation_audit_windows"("id")
ON DELETE restrict ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "plantation_audit_assignments"
ADD CONSTRAINT "plantation_audit_assignments_site_auditor_id_plantation_site_auditors_id_fk"
FOREIGN KEY ("site_auditor_id") REFERENCES "public"."plantation_site_auditors"("id")
ON DELETE restrict ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "plantation_audit_assignments"
ADD CONSTRAINT "plantation_audit_assignments_assigned_by_member_id_plantation_members_id_fk"
FOREIGN KEY ("assigned_by_member_id") REFERENCES "public"."plantation_members"("id")
ON DELETE restrict ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "plantation_audit_assignments"
ADD CONSTRAINT "plantation_audit_assignments_accepted_by_member_id_plantation_members_id_fk"
FOREIGN KEY ("accepted_by_member_id") REFERENCES "public"."plantation_members"("id")
ON DELETE restrict ON UPDATE no action;--> statement-breakpoint

CREATE UNIQUE INDEX "plantation_audit_assignments_active_window_unique"
ON "plantation_audit_assignments" USING btree ("window_id")
WHERE "status" IN ('assigned', 'accepted');--> statement-breakpoint

CREATE INDEX "plantation_audit_assignments_auditor_email_idx"
ON "plantation_audit_assignments" USING btree (lower(btrim("auditor_email")), "status");--> statement-breakpoint

CREATE INDEX "plantation_audit_assignments_site_id_idx"
ON "plantation_audit_assignments" USING btree ("site_id");--> statement-breakpoint

