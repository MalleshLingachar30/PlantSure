CREATE EXTENSION IF NOT EXISTS "pgcrypto";--> statement-breakpoint
CREATE TYPE "public"."plantation_audit_access_method" AS ENUM('qr', 'manual');--> statement-breakpoint
CREATE TYPE "public"."plantation_audit_band" AS ENUM('healthy', 'watch', 'poor', 'critical');--> statement-breakpoint
CREATE TYPE "public"."plantation_audit_frequency" AS ENUM('monthly', 'quarterly', 'half_yearly', 'annual');--> statement-breakpoint
CREATE TYPE "public"."plantation_audit_window_status" AS ENUM('scheduled', 'completed', 'missed', 'waived');--> statement-breakpoint
CREATE TYPE "public"."plantation_board_status" AS ENUM('generated', 'installed', 'damaged', 'missing', 'replaced', 'retired');--> statement-breakpoint
CREATE TYPE "public"."plantation_gps_status" AS ENUM('confirmed', 'plausible', 'questionable', 'unavailable');--> statement-breakpoint
CREATE TYPE "public"."plantation_program_status" AS ENUM('active', 'closed');--> statement-breakpoint
CREATE TYPE "public"."plantation_site_status" AS ENUM('registered', 'counts_confirmed', 'board_generated', 'board_installed', 'monitoring', 'closed');--> statement-breakpoint
CREATE TYPE "public"."plantation_window_event_type" AS ENUM('generated', 'completed', 'missed', 'notified', 'waived', 'reopened');--> statement-breakpoint
CREATE OR REPLACE FUNCTION plantation_audit_band_for_counts(planted integer, surviving integer)
RETURNS plantation_audit_band
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
	SELECT CASE
		WHEN planted = 0 THEN 'critical'
		WHEN ((surviving::numeric / planted::numeric) * 100) >= 85 THEN 'healthy'
		WHEN ((surviving::numeric / planted::numeric) * 100) >= 70 THEN 'watch'
		WHEN ((surviving::numeric / planted::numeric) * 100) >= 50 THEN 'poor'
		ELSE 'critical'
	END::plantation_audit_band;
$$;--> statement-breakpoint
CREATE TABLE "plantation_audit_windows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"sequence_number" integer NOT NULL,
	"cycle_label" text NOT NULL,
	"due_date" date NOT NULL,
	"grace_until" date NOT NULL,
	"status" "plantation_audit_window_status" DEFAULT 'scheduled' NOT NULL,
	"assigned_member_id" uuid,
	"audit_id" uuid,
	"missed_at" timestamp with time zone,
	"notified_at" timestamp with time zone,
	"waiver_reason" text,
	"waived_by" uuid,
	"waived_at" timestamp with time zone,
	CONSTRAINT "plantation_audit_windows_site_sequence_unique" UNIQUE("site_id","sequence_number")
);
--> statement-breakpoint
CREATE TABLE "plantation_audits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"window_id" uuid,
	"client_uuid" text NOT NULL,
	"auditor_member_id" uuid NOT NULL,
	"audited_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"access_method" "plantation_audit_access_method" NOT NULL,
	"planted_count" integer NOT NULL,
	"surviving_count" integer NOT NULL,
	"missing_count" integer GENERATED ALWAYS AS (greatest(planted_count - surviving_count, 0)) STORED NOT NULL,
	"survival_rate" numeric(5, 2) GENERATED ALWAYS AS (case when planted_count = 0 then 0 else round((surviving_count::numeric / planted_count::numeric) * 100, 2) end) STORED NOT NULL,
	"band" "plantation_audit_band" GENERATED ALWAYS AS (plantation_audit_band_for_counts(planted_count, surviving_count)) STORED NOT NULL,
	"latitude" numeric(9, 6),
	"longitude" numeric(9, 6),
	"gps_accuracy_m" numeric(8, 2),
	"distance_from_site_m" numeric(10, 2),
	"gps_status" "plantation_gps_status" NOT NULL,
	"photo_urls" jsonb NOT NULL,
	"remarks" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plantation_audits_client_uuid_unique" UNIQUE("client_uuid")
);
--> statement-breakpoint
CREATE TABLE "plantation_boards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"qr_url" text NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"generated_by" uuid NOT NULL,
	"installed_at" timestamp with time zone,
	"installed_by" uuid,
	"install_photo_url" text,
	"install_lat" numeric(9, 6),
	"install_lng" numeric(9, 6),
	"status" "plantation_board_status" DEFAULT 'generated' NOT NULL,
	CONSTRAINT "plantation_boards_site_id_unique" UNIQUE("site_id")
);
--> statement-breakpoint
CREATE TABLE "plantation_programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"knowledge_partner_org_id" uuid,
	"implementer_org_id" uuid,
	"monitoring_years" integer DEFAULT 5 NOT NULL,
	"audit_frequency" "plantation_audit_frequency" DEFAULT 'quarterly' NOT NULL,
	"survival_threshold" numeric(5, 2) DEFAULT '85' NOT NULL,
	"escalation_email" text NOT NULL,
	"status" "plantation_program_status" DEFAULT 'active' NOT NULL,
	"next_location_sequence" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plantation_sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"location_id" text NOT NULL,
	"name" text NOT NULL,
	"district" text NOT NULL,
	"taluk" text NOT NULL,
	"village" text NOT NULL,
	"latitude" numeric(9, 6) NOT NULL,
	"longitude" numeric(9, 6) NOT NULL,
	"planted_count" integer NOT NULL,
	"planting_date" date NOT NULL,
	"species_notes" text,
	"status" "plantation_site_status" DEFAULT 'registered' NOT NULL,
	"monitoring_start" date,
	"monitoring_end" date,
	"created_by_member_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plantation_sites_location_id_unique" UNIQUE("location_id")
);
--> statement-breakpoint
CREATE TABLE "plantation_window_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"window_id" uuid NOT NULL,
	"event_type" "plantation_window_event_type" NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"actor" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plantation_audit_windows" ADD CONSTRAINT "plantation_audit_windows_site_id_plantation_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."plantation_sites"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plantation_audits" ADD CONSTRAINT "plantation_audits_site_id_plantation_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."plantation_sites"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plantation_audits" ADD CONSTRAINT "plantation_audits_window_id_plantation_audit_windows_id_fk" FOREIGN KEY ("window_id") REFERENCES "public"."plantation_audit_windows"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plantation_boards" ADD CONSTRAINT "plantation_boards_site_id_plantation_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."plantation_sites"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plantation_sites" ADD CONSTRAINT "plantation_sites_program_id_plantation_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."plantation_programs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plantation_window_events" ADD CONSTRAINT "plantation_window_events_window_id_plantation_audit_windows_id_fk" FOREIGN KEY ("window_id") REFERENCES "public"."plantation_audit_windows"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "plantation_audit_windows_status_due_date_idx" ON "plantation_audit_windows" USING btree ("status","due_date");--> statement-breakpoint
CREATE INDEX "plantation_audits_site_id_idx" ON "plantation_audits" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "plantation_audits_window_id_idx" ON "plantation_audits" USING btree ("window_id");--> statement-breakpoint
CREATE INDEX "plantation_audits_client_uuid_idx" ON "plantation_audits" USING btree ("client_uuid");--> statement-breakpoint
CREATE INDEX "plantation_boards_site_id_idx" ON "plantation_boards" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "plantation_sites_program_id_idx" ON "plantation_sites" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "plantation_sites_location_id_idx" ON "plantation_sites" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "plantation_window_events_window_id_idx" ON "plantation_window_events" USING btree ("window_id");--> statement-breakpoint
CREATE INDEX "plantation_window_events_event_type_idx" ON "plantation_window_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "plantation_window_events_created_at_idx" ON "plantation_window_events" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_confirmed_site_planted_count_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF NEW.planted_count IS DISTINCT FROM OLD.planted_count
		AND (OLD.status <> 'registered' OR NEW.status <> 'registered') THEN
		RAISE EXCEPTION 'planted_count is locked after counts are confirmed'
			USING ERRCODE = 'check_violation';
	END IF;

	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER plantation_sites_lock_confirmed_planted_count
BEFORE UPDATE OF planted_count, status ON plantation_sites
FOR EACH ROW
EXECUTE FUNCTION prevent_confirmed_site_planted_count_update();--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_window_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	RAISE EXCEPTION 'plantation_window_events is append-only'
		USING ERRCODE = 'check_violation';
END;
$$;--> statement-breakpoint
CREATE TRIGGER plantation_window_events_append_only
BEFORE UPDATE OR DELETE ON plantation_window_events
FOR EACH ROW
EXECUTE FUNCTION prevent_window_event_mutation();
