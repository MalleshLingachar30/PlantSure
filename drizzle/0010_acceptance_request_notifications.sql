CREATE TYPE "plantation_notification_type" AS ENUM ('acceptance_request');--> statement-breakpoint
CREATE TYPE "plantation_notification_channel" AS ENUM ('email');--> statement-breakpoint
CREATE TYPE "plantation_notification_status" AS ENUM ('pending', 'sent', 'failed');--> statement-breakpoint

CREATE TABLE "plantation_notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "site_id" uuid NOT NULL,
  "acceptance_id" uuid,
  "notification_type" "plantation_notification_type" NOT NULL,
  "channel" "plantation_notification_channel" DEFAULT 'email' NOT NULL,
  "recipient_email" text NOT NULL,
  "subject" text NOT NULL,
  "status" "plantation_notification_status" DEFAULT 'pending' NOT NULL,
  "provider" text,
  "provider_message_id" text,
  "error_message" text,
  "triggered_by_member_id" uuid,
  "sent_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "plantation_notifications"
ADD CONSTRAINT "plantation_notifications_site_id_plantation_sites_id_fk"
FOREIGN KEY ("site_id") REFERENCES "plantation_sites"("id")
ON DELETE restrict ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "plantation_notifications"
ADD CONSTRAINT "plantation_notifications_acceptance_id_plantation_acceptances_id_fk"
FOREIGN KEY ("acceptance_id") REFERENCES "plantation_acceptances"("id")
ON DELETE restrict ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "plantation_notifications"
ADD CONSTRAINT "plantation_notifications_triggered_by_member_id_plantation_members_id_fk"
FOREIGN KEY ("triggered_by_member_id") REFERENCES "plantation_members"("id")
ON DELETE restrict ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "plantation_notifications_site_type_idx"
ON "plantation_notifications" USING btree ("site_id", "notification_type");--> statement-breakpoint

CREATE INDEX "plantation_notifications_acceptance_id_idx"
ON "plantation_notifications" USING btree ("acceptance_id");--> statement-breakpoint

CREATE INDEX "plantation_notifications_status_idx"
ON "plantation_notifications" USING btree ("status");--> statement-breakpoint
