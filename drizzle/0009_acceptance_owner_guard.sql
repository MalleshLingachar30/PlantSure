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

  SELECT lower(btrim(coalesce(programs.owner_approver_email, '')))
    INTO site_owner_approver_email
    FROM plantation_sites sites
    JOIN plantation_programs programs ON programs.id = sites.program_id
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
