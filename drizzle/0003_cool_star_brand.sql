CREATE TABLE "plantation_location_sequences" (
	"prefix" text PRIMARY KEY NOT NULL,
	"next_location_sequence" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "plantation_location_sequences" (
	"prefix",
	"next_location_sequence"
)
SELECT
	regexp_replace("location_id", '-[0-9]{6}$', '') AS "prefix",
	max(right("location_id", 6)::integer) + 1 AS "next_location_sequence"
FROM "plantation_sites"
GROUP BY regexp_replace("location_id", '-[0-9]{6}$', '')
ON CONFLICT ("prefix") DO UPDATE SET
	"next_location_sequence" = greatest(
		"plantation_location_sequences"."next_location_sequence",
		excluded."next_location_sequence"
	),
	"updated_at" = now();--> statement-breakpoint
CREATE OR REPLACE FUNCTION allocate_plantation_location_id(
	target_program_id uuid,
	state_code text,
	district_code text,
	village_code text
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
	allocated_sequence integer;
	location_prefix text;
	normalized_state text := upper(trim(state_code));
	normalized_district text := upper(trim(district_code));
	normalized_village text := upper(trim(village_code));
BEGIN
	PERFORM 1
	FROM plantation_programs
	WHERE id = target_program_id;

	IF NOT FOUND THEN
		RAISE EXCEPTION 'Plantation program not found'
			USING ERRCODE = 'check_violation';
	END IF;

	IF normalized_state !~ '^[A-Z]{2}$' THEN
		RAISE EXCEPTION 'state_code must be a two-letter uppercase code'
			USING ERRCODE = 'check_violation';
	END IF;

	IF normalized_district !~ '^[A-Z]{3}$' THEN
		RAISE EXCEPTION 'district_code must be a three-letter uppercase code'
			USING ERRCODE = 'check_violation';
	END IF;

	IF normalized_village !~ '^[A-Z]{3}$' THEN
		RAISE EXCEPTION 'village_code must be a three-letter uppercase code'
			USING ERRCODE = 'check_violation';
	END IF;

	location_prefix := normalized_state
		|| '-'
		|| normalized_district
		|| '-'
		|| normalized_village;

	INSERT INTO plantation_location_sequences (
		prefix,
		next_location_sequence
	) VALUES (
		location_prefix,
		2
	)
	ON CONFLICT (prefix) DO UPDATE SET
		next_location_sequence = plantation_location_sequences.next_location_sequence + 1,
		updated_at = now()
	WHERE plantation_location_sequences.next_location_sequence BETWEEN 1 AND 999999
	RETURNING next_location_sequence - 1 INTO allocated_sequence;

	IF allocated_sequence IS NULL THEN
		RAISE EXCEPTION 'Location ID sequence exhausted'
			USING ERRCODE = 'check_violation';
	END IF;

	RETURN location_prefix
		|| '-'
		|| lpad(allocated_sequence::text, 6, '0');
END;
$$;--> statement-breakpoint
ALTER TABLE "plantation_programs" DROP COLUMN "next_location_sequence";
