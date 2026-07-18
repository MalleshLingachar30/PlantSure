ALTER TABLE "plantation_programs" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;--> statement-breakpoint

INSERT INTO "plantation_members" (
  "id",
  "clerk_user_id",
  "email",
  "display_name",
  "role"
) VALUES (
  '00000000-0000-4000-8000-000000000d01',
  'seed:plantsure-demo',
  'demo@plantsure.feedbacknfc.com',
  'PlantSure Demo',
  'admin'
) ON CONFLICT ("clerk_user_id") DO NOTHING;--> statement-breakpoint

INSERT INTO "plantation_programs" (
  "id",
  "organization_id",
  "name",
  "monitoring_years",
  "audit_frequency",
  "survival_threshold",
  "escalation_email",
  "is_demo",
  "status"
) VALUES (
  '00000000-0000-4000-8000-000000000d10',
  '00000000-0000-4000-8000-000000000d11',
  'PlantSure Demo Programme',
  5,
  'quarterly',
  '85',
  'ml@feedbacknfc.com',
  true,
  'active'
) ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint

INSERT INTO "plantation_sites" (
  "id",
  "program_id",
  "location_id",
  "name",
  "district",
  "taluk",
  "village",
  "latitude",
  "longitude",
  "planted_count",
  "planting_date",
  "species_notes",
  "status",
  "monitoring_start",
  "monitoring_end",
  "created_by_member_id"
) VALUES (
  '00000000-0000-4000-8000-000000000d20',
  '00000000-0000-4000-8000-000000000d10',
  'KA-DMO-GUB-000001',
  'Gubbi demonstration site',
  'Tumakuru',
  'Gubbi',
  'Gubbi',
  '13.312000',
  '76.941000',
  600,
  '2021-07-15',
  'Mixed native',
  'counts_confirmed',
  '2021-07-15',
  '2026-07-15',
  '00000000-0000-4000-8000-000000000d01'
) ON CONFLICT ("location_id") DO NOTHING;--> statement-breakpoint

INSERT INTO "plantation_location_sequences" (
  "prefix",
  "next_location_sequence"
) VALUES (
  'KA-DMO-GUB',
  2
) ON CONFLICT ("prefix") DO UPDATE
SET
  "next_location_sequence" = greatest(
    "plantation_location_sequences"."next_location_sequence",
    excluded."next_location_sequence"
  ),
  "updated_at" = now();--> statement-breakpoint

WITH demo_windows AS (
  SELECT
    sequence_number,
    'Y' || ceil(sequence_number::numeric / 4)::int || '-Q' || (((sequence_number - 1) % 4) + 1) AS cycle_label,
    ('2021-07-15'::date + (sequence_number * interval '3 months'))::date AS due_date,
    ('2021-07-15'::date + (sequence_number * interval '3 months') + interval '14 days')::date AS grace_until
  FROM generate_series(1, 20) AS sequence_number
)
INSERT INTO "plantation_audit_windows" (
  "id",
  "site_id",
  "sequence_number",
  "cycle_label",
  "due_date",
  "grace_until",
  "status",
  "audit_id",
  "missed_at"
)
SELECT
  ('20000000-0000-4000-8000-' || lpad(sequence_number::text, 12, '0'))::uuid,
  '00000000-0000-4000-8000-000000000d20',
  sequence_number,
  cycle_label,
  due_date,
  grace_until,
  CASE WHEN sequence_number <= 9 THEN 'completed'::plantation_audit_window_status ELSE 'missed'::plantation_audit_window_status END,
  CASE WHEN sequence_number <= 9 THEN ('10000000-0000-4000-8000-' || lpad(sequence_number::text, 12, '0'))::uuid ELSE NULL END,
  CASE WHEN sequence_number > 9 THEN (grace_until::timestamp with time zone + interval '1 day') ELSE NULL END
FROM demo_windows
ON CONFLICT ("site_id", "sequence_number") DO NOTHING;--> statement-breakpoint

WITH completed_windows AS (
  SELECT
    "id",
    "sequence_number",
    "due_date"
  FROM "plantation_audit_windows"
  WHERE "site_id" = '00000000-0000-4000-8000-000000000d20'
    AND "sequence_number" <= 9
)
INSERT INTO "plantation_audits" (
  "id",
  "site_id",
  "window_id",
  "client_uuid",
  "auditor_member_id",
  "audited_at",
  "access_method",
  "planted_count",
  "surviving_count",
  "latitude",
  "longitude",
  "gps_accuracy_m",
  "distance_from_site_m",
  "gps_status",
  "photo_urls",
  "remarks"
)
SELECT
  ('10000000-0000-4000-8000-' || lpad("sequence_number"::text, 12, '0'))::uuid,
  '00000000-0000-4000-8000-000000000d20',
  "id",
  'plantsure-demo-' || lpad("sequence_number"::text, 6, '0'),
  '00000000-0000-4000-8000-000000000d01',
  ("due_date"::timestamp with time zone + interval '10 hours'),
  'qr',
  600,
  585 - ("sequence_number" * 10),
  '13.312000',
  '76.941000',
  '6.50',
  '4.20',
  'confirmed',
  jsonb_build_array('demo/site-check-' || lpad("sequence_number"::text, 2, '0') || '.jpg'),
  'Seeded demo audit for the public landing page.'
FROM completed_windows
ON CONFLICT ("client_uuid") DO NOTHING;--> statement-breakpoint

WITH all_windows AS (
  SELECT
    "id",
    "sequence_number",
    "due_date",
    "grace_until"
  FROM "plantation_audit_windows"
  WHERE "site_id" = '00000000-0000-4000-8000-000000000d20'
)
INSERT INTO "plantation_window_events" (
  "id",
  "window_id",
  "event_type",
  "detail",
  "actor",
  "created_at"
)
SELECT
  ('30000000-0000-4000-8000-' || lpad("sequence_number"::text, 12, '0'))::uuid,
  "id",
  'generated',
  jsonb_build_object(
    'sequenceNumber', "sequence_number",
    'dueDate', "due_date"::text,
    'graceUntil', "grace_until"::text,
    'seededDemo', true
  ),
  'system',
  '2021-07-15'::timestamp with time zone
FROM all_windows
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint

WITH completed_windows AS (
  SELECT
    "id",
    "sequence_number",
    "due_date"
  FROM "plantation_audit_windows"
  WHERE "site_id" = '00000000-0000-4000-8000-000000000d20'
    AND "sequence_number" <= 9
)
INSERT INTO "plantation_window_events" (
  "id",
  "window_id",
  "event_type",
  "detail",
  "actor",
  "created_at"
)
SELECT
  ('40000000-0000-4000-8000-' || lpad("sequence_number"::text, 12, '0'))::uuid,
  "id",
  'completed',
  jsonb_build_object(
    'sequenceNumber', "sequence_number",
    'survivingCount', 585 - ("sequence_number" * 10),
    'seededDemo', true
  ),
  'seed:plantsure-demo',
  ("due_date"::timestamp with time zone + interval '10 hours')
FROM completed_windows
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint

WITH missed_windows AS (
  SELECT
    "id",
    "sequence_number",
    "grace_until"
  FROM "plantation_audit_windows"
  WHERE "site_id" = '00000000-0000-4000-8000-000000000d20'
    AND "sequence_number" > 9
)
INSERT INTO "plantation_window_events" (
  "id",
  "window_id",
  "event_type",
  "detail",
  "actor",
  "created_at"
)
SELECT
  ('50000000-0000-4000-8000-' || lpad("sequence_number"::text, 12, '0'))::uuid,
  "id",
  'missed',
  jsonb_build_object(
    'sequenceNumber', "sequence_number",
    'graceUntil', "grace_until"::text,
    'seededDemo', true
  ),
  'system',
  ("grace_until"::timestamp with time zone + interval '1 day')
FROM missed_windows
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint

INSERT INTO "plantation_boards" (
  "id",
  "site_id",
  "qr_url",
  "generated_by",
  "status"
) VALUES (
  '00000000-0000-4000-8000-000000000d30',
  '00000000-0000-4000-8000-000000000d20',
  'https://plantsure.feedbacknfc.com/p/KA-DMO-GUB-000001',
  '00000000-0000-4000-8000-000000000d01',
  'generated'
) ON CONFLICT ("site_id") DO NOTHING;
