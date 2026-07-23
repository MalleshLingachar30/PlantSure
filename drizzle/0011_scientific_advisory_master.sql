CREATE TYPE "plantation_scientific_advisor_type" AS ENUM (
  'scientific_institute',
  'forest_department',
  'university',
  'independent',
  'other'
);--> statement-breakpoint

CREATE TYPE "plantation_organization_type" AS ENUM (
  'institution',
  'corporate',
  'foundation',
  'government',
  'community',
  'other'
);--> statement-breakpoint

CREATE TABLE "plantation_scientific_advisors" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "advisor_type" "plantation_scientific_advisor_type" DEFAULT 'scientific_institute' NOT NULL,
  "contact_name" text,
  "contact_email" text,
  "contact_phone" text,
  "notes" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "plantation_organizations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "organization_type" "plantation_organization_type" DEFAULT 'other' NOT NULL,
  "scientific_advisor_id" uuid NOT NULL,
  "primary_contact_name" text,
  "primary_contact_email" text,
  "primary_contact_phone" text,
  "owner_approver_name" text,
  "owner_approver_email" text NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "plantation_organizations"
ADD CONSTRAINT "plantation_organizations_scientific_advisor_id_plantation_scientific_advisors_id_fk"
FOREIGN KEY ("scientific_advisor_id") REFERENCES "plantation_scientific_advisors"("id")
ON DELETE restrict ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "plantation_scientific_advisors_name_idx"
ON "plantation_scientific_advisors" USING btree ("name");--> statement-breakpoint

CREATE INDEX "plantation_scientific_advisors_active_idx"
ON "plantation_scientific_advisors" USING btree ("is_active");--> statement-breakpoint

CREATE INDEX "plantation_organizations_name_idx"
ON "plantation_organizations" USING btree ("name");--> statement-breakpoint

CREATE INDEX "plantation_organizations_scientific_advisor_id_idx"
ON "plantation_organizations" USING btree ("scientific_advisor_id");--> statement-breakpoint

CREATE INDEX "plantation_organizations_owner_approver_email_idx"
ON "plantation_organizations" USING btree ("owner_approver_email");--> statement-breakpoint

CREATE INDEX "plantation_organizations_active_idx"
ON "plantation_organizations" USING btree ("is_active");--> statement-breakpoint

INSERT INTO "plantation_scientific_advisors" (
  "id",
  "name",
  "advisor_type",
  "contact_name",
  "contact_email",
  "notes"
) VALUES (
  '00000000-0000-4000-8000-00000000a001',
  'Unassigned scientific advisor',
  'other',
  'PlantSure backfill',
  'noreply@plantsure.feedbacknfc.com',
  'Backfill placeholder for legacy programmes created before the scientific advisory master existed.'
)
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint

INSERT INTO "plantation_organizations" (
  "id",
  "name",
  "organization_type",
  "scientific_advisor_id",
  "primary_contact_email",
  "owner_approver_email",
  "created_at",
  "updated_at"
)
SELECT
  programs.organization_id,
  coalesce(nullif(programs.name, ''), 'Legacy organization') || ' owner',
  'other'::plantation_organization_type,
  '00000000-0000-4000-8000-00000000a001',
  programs.escalation_email,
  coalesce(nullif(programs.owner_approver_email, ''), programs.escalation_email),
  now(),
  now()
FROM "plantation_programs" programs
LEFT JOIN "plantation_organizations" organizations
  ON organizations.id = programs.organization_id
WHERE organizations.id IS NULL;--> statement-breakpoint

ALTER TABLE "plantation_programs"
ADD CONSTRAINT "plantation_programs_organization_id_plantation_organizations_id_fk"
FOREIGN KEY ("organization_id") REFERENCES "plantation_organizations"("id")
ON DELETE restrict ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "plantation_programs"
DROP COLUMN "owner_approver_email";--> statement-breakpoint

CREATE OR REPLACE FUNCTION assert_plantation_acceptance_roles()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  submitter_role text;
  accepter_role text;
  rejecter_role text;
  accepter_email text;
  rejecter_email text;
  site_owner_approver_email text;
BEGIN
  submitter_role := plantation_member_role_for_id(NEW.submitted_by);

  IF submitter_role NOT IN ('manager', 'admin') THEN
    RAISE EXCEPTION 'plantation member role % cannot submit a baseline for acceptance', submitter_role
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT lower(btrim(coalesce(organizations.owner_approver_email, '')))
    INTO site_owner_approver_email
    FROM plantation_sites sites
    JOIN plantation_programs programs ON programs.id = sites.program_id
    JOIN plantation_organizations organizations ON organizations.id = programs.organization_id
    WHERE sites.id = NEW.site_id;

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

      SELECT lower(btrim(coalesce(email, '')))
        INTO accepter_email
        FROM plantation_members
        WHERE id = NEW.accepted_by;

      IF site_owner_approver_email = '' THEN
        RAISE EXCEPTION 'site does not have an assigned owner approver email'
          USING ERRCODE = 'check_violation';
      END IF;

      IF accepter_email <> site_owner_approver_email THEN
        RAISE EXCEPTION 'accepted baseline must be approved by the assigned project owner account'
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

      SELECT lower(btrim(coalesce(email, '')))
        INTO rejecter_email
        FROM plantation_members
        WHERE id = NEW.rejected_by;

      IF site_owner_approver_email = '' THEN
        RAISE EXCEPTION 'site does not have an assigned owner approver email'
          USING ERRCODE = 'check_violation';
      END IF;

      IF rejecter_email <> site_owner_approver_email THEN
        RAISE EXCEPTION 'rejected baseline must be decided by the assigned project owner account'
          USING ERRCODE = 'check_violation';
      END IF;
    ELSE
      RAISE EXCEPTION 'plantation member role % cannot reject a submitted baseline', rejecter_role
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
