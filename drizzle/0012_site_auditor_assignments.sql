CREATE TABLE "plantation_site_auditors" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "site_id" uuid NOT NULL,
  "email" text NOT NULL,
  "display_name" text,
  "active" boolean DEFAULT true NOT NULL,
  "created_by_member_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "plantation_site_auditors_email_not_blank_check"
    CHECK (length(btrim("email")) > 0)
);--> statement-breakpoint

ALTER TABLE "plantation_site_auditors"
ADD CONSTRAINT "plantation_site_auditors_site_id_plantation_sites_id_fk"
FOREIGN KEY ("site_id") REFERENCES "public"."plantation_sites"("id")
ON DELETE restrict ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "plantation_site_auditors"
ADD CONSTRAINT "plantation_site_auditors_created_by_member_id_plantation_members_id_fk"
FOREIGN KEY ("created_by_member_id") REFERENCES "public"."plantation_members"("id")
ON DELETE restrict ON UPDATE no action;--> statement-breakpoint

CREATE UNIQUE INDEX "plantation_site_auditors_site_email_unique"
ON "plantation_site_auditors" USING btree ("site_id", lower(btrim("email")));--> statement-breakpoint

CREATE INDEX "plantation_site_auditors_email_idx"
ON "plantation_site_auditors" USING btree (lower(btrim("email")))
WHERE "active" = true;--> statement-breakpoint

