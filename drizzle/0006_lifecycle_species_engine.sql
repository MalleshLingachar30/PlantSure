CREATE TYPE "public"."plantation_land_ownership" AS ENUM('government', 'private', 'institutional', 'other');--> statement-breakpoint
CREATE TYPE "public"."plantation_type" AS ENUM('block', 'bund_only', 'bund_and_block');--> statement-breakpoint
CREATE TYPE "public"."plantation_lifecycle_stage" AS ENUM(
  'land_identified',
  'land_verified',
  'species_configured',
  'material_arranged',
  'pits_dug',
  'planted',
  'submitted_for_acceptance',
  'accepted',
  'monitoring',
  'archived'
);--> statement-breakpoint
CREATE TYPE "public"."plantation_acceptance_role" AS ENUM('primary', 'fallback');--> statement-breakpoint

ALTER TABLE "plantation_sites"
ADD COLUMN "land_ownership" "plantation_land_ownership" DEFAULT 'other' NOT NULL,
ADD COLUMN "land_custodian" text,
ADD COLUMN "approval_reference" text,
ADD COLUMN "is_shared_parcel" boolean DEFAULT false NOT NULL,
ADD COLUMN "watch_and_ward" boolean DEFAULT false NOT NULL,
ADD COLUMN "boundary_points" jsonb DEFAULT '[]'::jsonb NOT NULL,
ADD COLUMN "plantation_type" "plantation_type" DEFAULT 'block' NOT NULL,
ADD COLUMN "stage" "plantation_lifecycle_stage" DEFAULT 'land_identified' NOT NULL,
ADD CONSTRAINT "plantation_sites_boundary_points_array_check"
  CHECK (jsonb_typeof("boundary_points") = 'array');--> statement-breakpoint

UPDATE "plantation_sites"
SET "stage" = CASE
  WHEN "status" = 'counts_confirmed' THEN 'monitoring'::"plantation_lifecycle_stage"
  ELSE 'land_identified'::"plantation_lifecycle_stage"
END;--> statement-breakpoint

CREATE TABLE "plantation_batch_species" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "site_id" uuid NOT NULL,
  "species_name" text NOT NULL,
  "planted_count" integer NOT NULL,
  "spacing_notes" text,
  "placement" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "plantation_batch_species_positive_count_check"
    CHECK ("planted_count" > 0),
  CONSTRAINT "plantation_batch_species_name_not_blank_check"
    CHECK (length(btrim("species_name")) > 0)
);--> statement-breakpoint

ALTER TABLE "plantation_batch_species"
ADD CONSTRAINT "plantation_batch_species_site_id_plantation_sites_id_fk"
FOREIGN KEY ("site_id") REFERENCES "public"."plantation_sites"("id")
ON DELETE restrict ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "plantation_batch_species_site_id_idx"
ON "plantation_batch_species" USING btree ("site_id");--> statement-breakpoint

INSERT INTO "plantation_batch_species" (
  "site_id",
  "species_name",
  "planted_count",
  "spacing_notes"
)
SELECT
  "id",
  coalesce(nullif(btrim("species_notes"), ''), 'Mixed'),
  "planted_count",
  "species_notes"
FROM "plantation_sites"
WHERE "planted_count" > 0
ON CONFLICT DO NOTHING;--> statement-breakpoint

CREATE TABLE "plantation_audit_species_results" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "audit_id" uuid NOT NULL,
  "species_name" text NOT NULL,
  "planted_count" integer NOT NULL,
  "surviving_count" integer NOT NULL,
  "survival_rate" numeric(5, 2) GENERATED ALWAYS AS (
    case
      when planted_count = 0 then 0
      else round((surviving_count::numeric / planted_count::numeric) * 100, 2)
    end
  ) STORED NOT NULL,
  CONSTRAINT "plantation_audit_species_results_counts_check"
    CHECK ("planted_count" > 0 AND "surviving_count" >= 0)
);--> statement-breakpoint

ALTER TABLE "plantation_audit_species_results"
ADD CONSTRAINT "plantation_audit_species_results_audit_id_plantation_audits_id_fk"
FOREIGN KEY ("audit_id") REFERENCES "public"."plantation_audits"("id")
ON DELETE restrict ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "plantation_audit_species_results_audit_id_idx"
ON "plantation_audit_species_results" USING btree ("audit_id");--> statement-breakpoint

CREATE TABLE "plantation_stage_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "site_id" uuid NOT NULL,
  "from_stage" "plantation_lifecycle_stage",
  "to_stage" "plantation_lifecycle_stage" NOT NULL,
  "actor" text NOT NULL,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "plantation_stage_events"
ADD CONSTRAINT "plantation_stage_events_site_id_plantation_sites_id_fk"
FOREIGN KEY ("site_id") REFERENCES "public"."plantation_sites"("id")
ON DELETE restrict ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "plantation_stage_events_site_id_created_at_idx"
ON "plantation_stage_events" USING btree ("site_id", "created_at" DESC);--> statement-breakpoint

CREATE TABLE "plantation_evidence" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "site_id" uuid NOT NULL,
  "stage" "plantation_lifecycle_stage" NOT NULL,
  "audit_id" uuid,
  "url" text NOT NULL,
  "captured_at" timestamp with time zone NOT NULL,
  "received_at" timestamp with time zone DEFAULT now() NOT NULL,
  "latitude" numeric(9, 6),
  "longitude" numeric(9, 6),
  "gps_accuracy" numeric(8, 2),
  "caption" text,
  "uploaded_by" uuid NOT NULL,
  CONSTRAINT "plantation_evidence_url_not_blank_check"
    CHECK (length(btrim("url")) > 0)
);--> statement-breakpoint

ALTER TABLE "plantation_evidence"
ADD CONSTRAINT "plantation_evidence_site_id_plantation_sites_id_fk"
FOREIGN KEY ("site_id") REFERENCES "public"."plantation_sites"("id")
ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plantation_evidence"
ADD CONSTRAINT "plantation_evidence_audit_id_plantation_audits_id_fk"
FOREIGN KEY ("audit_id") REFERENCES "public"."plantation_audits"("id")
ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plantation_evidence"
ADD CONSTRAINT "plantation_evidence_uploaded_by_plantation_members_id_fk"
FOREIGN KEY ("uploaded_by") REFERENCES "public"."plantation_members"("id")
ON DELETE restrict ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "plantation_evidence_site_stage_idx"
ON "plantation_evidence" USING btree ("site_id", "stage");--> statement-breakpoint
CREATE INDEX "plantation_evidence_audit_id_idx"
ON "plantation_evidence" USING btree ("audit_id");--> statement-breakpoint

CREATE TABLE "plantation_acceptances" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "site_id" uuid NOT NULL,
  "submitted_by" uuid NOT NULL,
  "submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
  "accepted_by" uuid,
  "accepted_role" "plantation_acceptance_role",
  "accepted_at" timestamp with time zone,
  "accepted_snapshot" jsonb,
  CONSTRAINT "plantation_acceptances_site_id_unique" UNIQUE("site_id")
);--> statement-breakpoint

ALTER TABLE "plantation_acceptances"
ADD CONSTRAINT "plantation_acceptances_site_id_plantation_sites_id_fk"
FOREIGN KEY ("site_id") REFERENCES "public"."plantation_sites"("id")
ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plantation_acceptances"
ADD CONSTRAINT "plantation_acceptances_submitted_by_plantation_members_id_fk"
FOREIGN KEY ("submitted_by") REFERENCES "public"."plantation_members"("id")
ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plantation_acceptances"
ADD CONSTRAINT "plantation_acceptances_accepted_by_plantation_members_id_fk"
FOREIGN KEY ("accepted_by") REFERENCES "public"."plantation_members"("id")
ON DELETE restrict ON UPDATE no action;--> statement-breakpoint

CREATE OR REPLACE FUNCTION prevent_direct_planted_count_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.planted_count IS DISTINCT FROM OLD.planted_count
    AND current_setting('plantsure.refreshing_species_sum', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'planted_count is derived from species rows'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint

DROP TRIGGER IF EXISTS plantation_sites_lock_confirmed_planted_count
ON "plantation_sites";--> statement-breakpoint
CREATE TRIGGER plantation_sites_prevent_direct_planted_count_update
BEFORE UPDATE OF "planted_count" ON "plantation_sites"
FOR EACH ROW
EXECUTE FUNCTION prevent_direct_planted_count_update();--> statement-breakpoint

CREATE OR REPLACE FUNCTION prevent_locked_species_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_site_id uuid := coalesce(NEW.site_id, OLD.site_id);
  current_stage plantation_lifecycle_stage;
  current_status plantation_site_status;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.site_id IS DISTINCT FROM OLD.site_id THEN
    RAISE EXCEPTION 'species rows cannot move between sites'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT "stage", "status"
  INTO current_stage, current_status
  FROM "plantation_sites"
  WHERE "id" = target_site_id
  FOR SHARE;

  IF current_stage IN ('accepted', 'monitoring', 'archived')
    OR current_status <> 'registered' THEN
    RAISE EXCEPTION 'species composition is locked after acceptance'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN coalesce(NEW, OLD);
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION refresh_site_planted_count_from_species()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  changed_site_id uuid := coalesce(NEW.site_id, OLD.site_id);
  refreshed_count integer;
BEGIN
  SELECT coalesce(sum("planted_count"), 0)::integer
  INTO refreshed_count
  FROM "plantation_batch_species"
  WHERE "site_id" = changed_site_id;

  PERFORM set_config('plantsure.refreshing_species_sum', 'on', true);

  UPDATE "plantation_sites"
  SET
    "planted_count" = refreshed_count,
    "updated_at" = now()
  WHERE "id" = changed_site_id;

  PERFORM set_config('plantsure.refreshing_species_sum', 'off', true);

  RETURN NULL;
END;
$$;--> statement-breakpoint

CREATE TRIGGER plantation_batch_species_prevent_locked_mutation
BEFORE INSERT OR UPDATE OR DELETE ON "plantation_batch_species"
FOR EACH ROW
EXECUTE FUNCTION prevent_locked_species_mutation();--> statement-breakpoint
CREATE TRIGGER plantation_batch_species_refresh_site_count
AFTER INSERT OR UPDATE OR DELETE ON "plantation_batch_species"
FOR EACH ROW
EXECUTE FUNCTION refresh_site_planted_count_from_species();--> statement-breakpoint

CREATE OR REPLACE FUNCTION prevent_stage_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'plantation_stage_events is append-only'
    USING ERRCODE = 'check_violation';
END;
$$;--> statement-breakpoint
CREATE TRIGGER plantation_stage_events_append_only
BEFORE UPDATE OR DELETE ON "plantation_stage_events"
FOR EACH ROW
EXECUTE FUNCTION prevent_stage_event_mutation();--> statement-breakpoint

CREATE OR REPLACE FUNCTION prevent_direct_site_stage_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.stage IS DISTINCT FROM OLD.stage
    AND current_setting('plantsure.advance_site_stage', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'site stage must advance through advance_plantation_site_stage'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER plantation_sites_prevent_direct_stage_update
BEFORE UPDATE OF "stage" ON "plantation_sites"
FOR EACH ROW
EXECUTE FUNCTION prevent_direct_site_stage_update();--> statement-breakpoint

CREATE OR REPLACE FUNCTION plantation_stage_position(value plantation_lifecycle_stage)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE value
    WHEN 'land_identified' THEN 1
    WHEN 'land_verified' THEN 2
    WHEN 'species_configured' THEN 3
    WHEN 'material_arranged' THEN 4
    WHEN 'pits_dug' THEN 5
    WHEN 'planted' THEN 6
    WHEN 'submitted_for_acceptance' THEN 7
    WHEN 'accepted' THEN 8
    WHEN 'monitoring' THEN 9
    WHEN 'archived' THEN 10
  END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION advance_plantation_site_stage(
  target_site_id uuid,
  target_stage plantation_lifecycle_stage,
  actor text,
  notes text DEFAULT NULL
)
RETURNS plantation_lifecycle_stage
LANGUAGE plpgsql
AS $$
DECLARE
  current_stage plantation_lifecycle_stage;
  current_position integer;
  target_position integer;
  evidence_count integer;
  species_count integer;
BEGIN
  SELECT "stage"
  INTO current_stage
  FROM "plantation_sites"
  WHERE "id" = target_site_id
  FOR UPDATE;

  IF current_stage IS NULL THEN
    RAISE EXCEPTION 'Plantation site not found'
      USING ERRCODE = 'check_violation';
  END IF;

  IF current_stage = target_stage THEN
    RETURN current_stage;
  END IF;

  current_position := plantation_stage_position(current_stage);
  target_position := plantation_stage_position(target_stage);

  IF target_position <> current_position + 1 THEN
    RAISE EXCEPTION 'site stage must move forward one step at a time'
      USING ERRCODE = 'check_violation';
  END IF;

  IF target_stage IN ('pits_dug', 'planted') THEN
    SELECT count(*)::integer
    INTO evidence_count
    FROM "plantation_evidence"
    WHERE "site_id" = target_site_id
      AND "stage" = target_stage;

    IF evidence_count = 0 THEN
      RAISE EXCEPTION 'required stage evidence is missing'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF target_stage = 'accepted' THEN
    SELECT count(*)::integer
    INTO species_count
    FROM "plantation_batch_species"
    WHERE "site_id" = target_site_id;

    IF species_count = 0 THEN
      RAISE EXCEPTION 'species composition is required before acceptance'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  PERFORM set_config('plantsure.advance_site_stage', 'on', true);

  UPDATE "plantation_sites"
  SET
    "stage" = target_stage,
    "updated_at" = now()
  WHERE "id" = target_site_id;

  PERFORM set_config('plantsure.advance_site_stage', 'off', true);

  INSERT INTO "plantation_stage_events" (
    "site_id",
    "from_stage",
    "to_stage",
    "actor",
    "notes"
  ) VALUES (
    target_site_id,
    current_stage,
    target_stage,
    actor,
    notes
  );

  RETURN target_stage;
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION prevent_direct_window_status_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
    AND current_setting('plantsure.advance_window_state', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'window status must advance through advance_plantation_window_state'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER plantation_audit_windows_prevent_direct_status_update
BEFORE UPDATE OF "status" ON "plantation_audit_windows"
FOR EACH ROW
EXECUTE FUNCTION prevent_direct_window_status_update();--> statement-breakpoint

CREATE OR REPLACE FUNCTION advance_plantation_window_state(
  target_window_id uuid,
  target_status plantation_audit_window_status,
  actor text
)
RETURNS plantation_audit_window_status
LANGUAGE plpgsql
AS $$
DECLARE
  current_status plantation_audit_window_status;
BEGIN
  SELECT "status"
  INTO current_status
  FROM "plantation_audit_windows"
  WHERE "id" = target_window_id
  FOR UPDATE;

  IF current_status IS NULL THEN
    RAISE EXCEPTION 'Audit window not found'
      USING ERRCODE = 'check_violation';
  END IF;

  IF current_status = target_status THEN
    RETURN current_status;
  END IF;

  IF current_status = 'completed'
    OR (current_status = 'missed' AND target_status <> 'completed')
    OR target_status = 'scheduled' THEN
    RAISE EXCEPTION 'illegal audit window transition'
      USING ERRCODE = 'check_violation';
  END IF;

  PERFORM set_config('plantsure.advance_window_state', 'on', true);

  UPDATE "plantation_audit_windows"
  SET
    "status" = target_status,
    "missed_at" = CASE
      WHEN target_status = 'missed' THEN coalesce("missed_at", now())
      ELSE "missed_at"
    END
  WHERE "id" = target_window_id;

  PERFORM set_config('plantsure.advance_window_state', 'off', true);

  INSERT INTO "plantation_window_events" (
    "window_id",
    "event_type",
    "detail",
    "actor"
  ) VALUES (
    target_window_id,
    target_status::text::plantation_window_event_type,
    jsonb_build_object('from_status', current_status, 'to_status', target_status),
    actor
  );

  RETURN target_status;
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION prevent_accepted_acceptance_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'accepted plantation acceptance records are locked'
      USING ERRCODE = 'check_violation';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'accepted plantation acceptance records are locked'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN coalesce(NEW, OLD);
END;
$$;--> statement-breakpoint
CREATE TRIGGER plantation_acceptances_lock_accepted
BEFORE UPDATE OR DELETE ON "plantation_acceptances"
FOR EACH ROW
EXECUTE FUNCTION prevent_accepted_acceptance_mutation();
