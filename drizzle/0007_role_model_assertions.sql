ALTER TYPE "plantation_member_role" ADD VALUE IF NOT EXISTS 'manager';--> statement-breakpoint
ALTER TYPE "plantation_member_role" ADD VALUE IF NOT EXISTS 'technician';--> statement-breakpoint

ALTER TABLE "plantation_acceptances"
ADD COLUMN "accepted_as_admin" boolean DEFAULT false NOT NULL,
ADD COLUMN "rejected_by" uuid,
ADD COLUMN "rejected_at" timestamp with time zone,
ADD COLUMN "rejection_reason" text,
ADD COLUMN "rejected_as_admin" boolean DEFAULT false NOT NULL,
ADD CONSTRAINT "plantation_acceptances_one_decision_check"
  CHECK ("accepted_at" IS NULL OR "rejected_at" IS NULL),
ADD CONSTRAINT "plantation_acceptances_acceptance_shape_check"
  CHECK (
    (
      "accepted_at" IS NULL
      AND "accepted_by" IS NULL
      AND "accepted_role" IS NULL
      AND "accepted_as_admin" = false
    )
    OR
    (
      "accepted_at" IS NOT NULL
      AND "accepted_by" IS NOT NULL
      AND (
        ("accepted_as_admin" = true AND "accepted_role" IS NULL)
        OR
        ("accepted_as_admin" = false AND "accepted_role" IS NOT NULL)
      )
    )
  ),
ADD CONSTRAINT "plantation_acceptances_rejection_shape_check"
  CHECK (
    (
      "rejected_at" IS NULL
      AND "rejected_by" IS NULL
      AND "rejected_as_admin" = false
    )
    OR
    (
      "rejected_at" IS NOT NULL
      AND "rejected_by" IS NOT NULL
    )
  );--> statement-breakpoint

ALTER TABLE "plantation_acceptances"
ADD CONSTRAINT "plantation_acceptances_rejected_by_plantation_members_id_fk"
FOREIGN KEY ("rejected_by") REFERENCES "public"."plantation_members"("id")
ON DELETE restrict ON UPDATE no action;--> statement-breakpoint

CREATE OR REPLACE FUNCTION plantation_member_role_for_actor(actor text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  actor_id uuid;
  actor_role text;
BEGIN
  BEGIN
    actor_id := actor::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'human actor must be a plantation member id'
      USING ERRCODE = 'check_violation';
  END;

  SELECT "role"::text
  INTO actor_role
  FROM "plantation_members"
  WHERE "id" = actor_id;

  IF actor_role IS NULL THEN
    RAISE EXCEPTION 'plantation member not found'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN actor_role;
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION plantation_member_role_for_id(member_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  member_role text;
BEGIN
  SELECT "role"::text
  INTO member_role
  FROM "plantation_members"
  WHERE "id" = member_id;

  IF member_role IS NULL THEN
    RAISE EXCEPTION 'plantation member not found'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN member_role;
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION assert_plantation_actor_role(
  actor text,
  allowed_roles text[],
  action_name text
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  actor_role text;
BEGIN
  actor_role := plantation_member_role_for_actor(actor);

  IF NOT actor_role = ANY(allowed_roles) THEN
    RAISE EXCEPTION 'plantation member role % cannot %', actor_role, action_name
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN actor_role;
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
  acceptance_count integer;
BEGIN
  IF target_stage IN (
    'land_verified',
    'species_configured',
    'material_arranged',
    'pits_dug',
    'planted',
    'submitted_for_acceptance'
  ) THEN
    PERFORM assert_plantation_actor_role(actor, ARRAY['manager', 'admin'], 'advance planting stages');
  ELSIF target_stage = 'accepted' THEN
    PERFORM assert_plantation_actor_role(actor, ARRAY['technician', 'admin'], 'accept a submitted baseline');
  ELSE
    PERFORM assert_plantation_actor_role(actor, ARRAY['admin'], 'advance this site stage');
  END IF;

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

    SELECT count(*)::integer
    INTO acceptance_count
    FROM "plantation_acceptances"
    WHERE "site_id" = target_site_id
      AND "accepted_at" IS NOT NULL
      AND "rejected_at" IS NULL;

    IF acceptance_count = 0 THEN
      RAISE EXCEPTION 'accepted baseline record is required'
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
  IF target_status = 'completed' THEN
    PERFORM assert_plantation_actor_role(actor, ARRAY['auditor', 'admin'], 'record checks');
  ELSIF target_status = 'missed' THEN
    IF actor NOT IN ('cron', 'system:cron') THEN
      RAISE EXCEPTION 'missed windows can only be recorded by cron'
        USING ERRCODE = 'check_violation';
    END IF;
  ELSIF target_status = 'waived' THEN
    PERFORM assert_plantation_actor_role(actor, ARRAY['admin'], 'waive audit windows');
  END IF;

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

CREATE OR REPLACE FUNCTION assert_plantation_acceptance_roles()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  submitter_role text;
  accepter_role text;
  rejecter_role text;
BEGIN
  submitter_role := plantation_member_role_for_id(NEW.submitted_by);

  IF submitter_role NOT IN ('manager', 'admin') THEN
    RAISE EXCEPTION 'plantation member role % cannot submit a baseline for acceptance', submitter_role
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.accepted_at IS NOT NULL THEN
    accepter_role := plantation_member_role_for_id(NEW.accepted_by);

    IF NEW.submitted_by = NEW.accepted_by AND accepter_role <> 'admin' THEN
      RAISE EXCEPTION 'registrar and sponsor must be different members'
        USING ERRCODE = 'check_violation';
    END IF;

    IF accepter_role = 'admin' THEN
      IF NEW.accepted_as_admin IS DISTINCT FROM true OR NEW.accepted_role IS NOT NULL THEN
        RAISE EXCEPTION 'admin acceptance must be recorded as admin break-glass'
          USING ERRCODE = 'check_violation';
      END IF;
    ELSIF accepter_role = 'technician' THEN
      IF NEW.accepted_as_admin IS DISTINCT FROM false OR NEW.accepted_role IS NULL THEN
        RAISE EXCEPTION 'sponsor acceptance must record primary or fallback role'
          USING ERRCODE = 'check_violation';
      END IF;
    ELSE
      RAISE EXCEPTION 'plantation member role % cannot accept a submitted baseline', accepter_role
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF NEW.rejected_at IS NOT NULL THEN
    rejecter_role := plantation_member_role_for_id(NEW.rejected_by);

    IF NEW.submitted_by = NEW.rejected_by AND rejecter_role <> 'admin' THEN
      RAISE EXCEPTION 'registrar and sponsor must be different members'
        USING ERRCODE = 'check_violation';
    END IF;

    IF rejecter_role = 'admin' THEN
      IF NEW.rejected_as_admin IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'admin rejection must be recorded as admin break-glass'
          USING ERRCODE = 'check_violation';
      END IF;
    ELSIF rejecter_role = 'technician' THEN
      IF NEW.rejected_as_admin IS DISTINCT FROM false THEN
        RAISE EXCEPTION 'sponsor rejection must not be recorded as admin break-glass'
          USING ERRCODE = 'check_violation';
      END IF;
    ELSE
      RAISE EXCEPTION 'plantation member role % cannot reject a submitted baseline', rejecter_role
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE TRIGGER plantation_acceptances_assert_roles
BEFORE INSERT OR UPDATE ON "plantation_acceptances"
FOR EACH ROW
EXECUTE FUNCTION assert_plantation_acceptance_roles();--> statement-breakpoint

CREATE OR REPLACE FUNCTION prevent_accepted_acceptance_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND (OLD.accepted_at IS NOT NULL OR OLD.rejected_at IS NOT NULL) THEN
    RAISE EXCEPTION 'decided plantation acceptance records are locked'
      USING ERRCODE = 'check_violation';
  END IF;

  IF TG_OP = 'UPDATE' AND (OLD.accepted_at IS NOT NULL OR OLD.rejected_at IS NOT NULL) THEN
    RAISE EXCEPTION 'decided plantation acceptance records are locked'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN coalesce(NEW, OLD);
END;
$$;
