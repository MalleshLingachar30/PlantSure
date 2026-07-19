import { sql } from 'drizzle-orm'
import {
  date,
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

export const auditFrequencyEnum = pgEnum('plantation_audit_frequency', [
  'monthly',
  'quarterly',
  'half_yearly',
  'annual',
])

export const programStatusEnum = pgEnum('plantation_program_status', ['active', 'closed'])

export const siteStatusEnum = pgEnum('plantation_site_status', [
  'registered',
  'counts_confirmed',
  'board_generated',
  'board_installed',
  'monitoring',
  'closed',
])

export const boardStatusEnum = pgEnum('plantation_board_status', [
  'generated',
  'installed',
  'damaged',
  'missing',
  'replaced',
  'retired',
])

export const auditWindowStatusEnum = pgEnum('plantation_audit_window_status', [
  'scheduled',
  'completed',
  'missed',
  'waived',
])

export const auditAccessMethodEnum = pgEnum('plantation_audit_access_method', ['qr', 'manual'])

export const auditBandEnum = pgEnum('plantation_audit_band', [
  'healthy',
  'watch',
  'poor',
  'critical',
])

export const gpsStatusEnum = pgEnum('plantation_gps_status', [
  'confirmed',
  'plausible',
  'questionable',
  'unavailable',
])

export const windowEventTypeEnum = pgEnum('plantation_window_event_type', [
  'generated',
  'completed',
  'missed',
  'notified',
  'waived',
  'reopened',
])

export const memberRoleEnum = pgEnum('plantation_member_role', [
  'admin',
  'auditor',
])

export const landOwnershipEnum = pgEnum('plantation_land_ownership', [
  'government',
  'private',
  'institutional',
  'other',
])

export const plantationTypeEnum = pgEnum('plantation_type', [
  'block',
  'bund_only',
  'bund_and_block',
])

export const lifecycleStageEnum = pgEnum('plantation_lifecycle_stage', [
  'land_identified',
  'land_verified',
  'species_configured',
  'material_arranged',
  'pits_dug',
  'planted',
  'submitted_for_acceptance',
  'accepted',
  'monitoring',
  'archived',
])

export const acceptanceRoleEnum = pgEnum('plantation_acceptance_role', [
  'primary',
  'fallback',
])

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}

export const plantationPrograms = pgTable('plantation_programs', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull(),
  name: text('name').notNull(),
  knowledgePartnerOrgId: uuid('knowledge_partner_org_id'),
  implementerOrgId: uuid('implementer_org_id'),
  monitoringYears: integer('monitoring_years').default(5).notNull(),
  auditFrequency: auditFrequencyEnum('audit_frequency').default('quarterly').notNull(),
  survivalThreshold: numeric('survival_threshold', { precision: 5, scale: 2 }).default('85').notNull(),
  escalationEmail: text('escalation_email').notNull(),
  isDemo: boolean('is_demo').default(false).notNull(),
  status: programStatusEnum('status').default('active').notNull(),
  ...timestamps,
})

export const plantationLocationSequences = pgTable('plantation_location_sequences', {
  prefix: text('prefix').primaryKey(),
  nextLocationSequence: integer('next_location_sequence').default(1).notNull(),
  ...timestamps,
})

export const plantationMembers = pgTable(
  'plantation_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clerkUserId: text('clerk_user_id').notNull().unique(),
    email: text('email'),
    displayName: text('display_name'),
    role: memberRoleEnum('role').default('auditor').notNull(),
    ...timestamps,
  },
  (table) => ({
    clerkUserIdIdx: index('plantation_members_clerk_user_id_idx').on(table.clerkUserId),
  }),
)

export const plantationSites = pgTable(
  'plantation_sites',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    programId: uuid('program_id')
      .notNull()
      .references(() => plantationPrograms.id, { onDelete: 'restrict' }),
    locationId: text('location_id').notNull().unique(),
    name: text('name').notNull(),
    district: text('district').notNull(),
    taluk: text('taluk').notNull(),
    village: text('village').notNull(),
    latitude: numeric('latitude', { precision: 9, scale: 6 }).notNull(),
    longitude: numeric('longitude', { precision: 9, scale: 6 }).notNull(),
    plantedCount: integer('planted_count').notNull(),
    plantingDate: date('planting_date').notNull(),
    plantingPhotoUrls: jsonb('planting_photo_urls').$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
    speciesNotes: text('species_notes'),
    status: siteStatusEnum('status').default('registered').notNull(),
    monitoringStart: date('monitoring_start'),
    monitoringEnd: date('monitoring_end'),
    landOwnership: landOwnershipEnum('land_ownership').default('other').notNull(),
    landCustodian: text('land_custodian'),
    approvalReference: text('approval_reference'),
    isSharedParcel: boolean('is_shared_parcel').default(false).notNull(),
    watchAndWard: boolean('watch_and_ward').default(false).notNull(),
    boundaryPoints: jsonb('boundary_points').$type<Array<{ lat: number; lng: number }>>().default(sql`'[]'::jsonb`).notNull(),
    plantationType: plantationTypeEnum('plantation_type').default('block').notNull(),
    stage: lifecycleStageEnum('stage').default('land_identified').notNull(),
    createdByMemberId: uuid('created_by_member_id')
      .notNull()
      .references(() => plantationMembers.id, { onDelete: 'restrict' }),
    ...timestamps,
  },
  (table) => ({
    programIdx: index('plantation_sites_program_id_idx').on(table.programId),
    locationIdIdx: index('plantation_sites_location_id_idx').on(table.locationId),
  }),
)

export const plantationBatchSpecies = pgTable(
  'plantation_batch_species',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    siteId: uuid('site_id')
      .notNull()
      .references(() => plantationSites.id, { onDelete: 'restrict' }),
    speciesName: text('species_name').notNull(),
    plantedCount: integer('planted_count').notNull(),
    spacingNotes: text('spacing_notes'),
    placement: text('placement'),
    ...timestamps,
  },
  (table) => ({
    siteIdx: index('plantation_batch_species_site_id_idx').on(table.siteId),
  }),
)

export const plantationBoards = pgTable(
  'plantation_boards',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    siteId: uuid('site_id')
      .notNull()
      .references(() => plantationSites.id, { onDelete: 'restrict' })
      .unique(),
    qrUrl: text('qr_url').notNull(),
    generatedAt: timestamp('generated_at', { withTimezone: true }).defaultNow().notNull(),
    generatedBy: uuid('generated_by')
      .notNull()
      .references(() => plantationMembers.id, { onDelete: 'restrict' }),
    installedAt: timestamp('installed_at', { withTimezone: true }),
    installedBy: uuid('installed_by').references(() => plantationMembers.id, {
      onDelete: 'restrict',
    }),
    installPhotoUrl: text('install_photo_url'),
    installLat: numeric('install_lat', { precision: 9, scale: 6 }),
    installLng: numeric('install_lng', { precision: 9, scale: 6 }),
    status: boardStatusEnum('status').default('generated').notNull(),
  },
  (table) => ({
    siteIdx: index('plantation_boards_site_id_idx').on(table.siteId),
  }),
)

export const plantationAuditWindows = pgTable(
  'plantation_audit_windows',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    siteId: uuid('site_id')
      .notNull()
      .references(() => plantationSites.id, { onDelete: 'restrict' }),
    sequenceNumber: integer('sequence_number').notNull(),
    cycleLabel: text('cycle_label').notNull(),
    dueDate: date('due_date').notNull(),
    graceUntil: date('grace_until').notNull(),
    status: auditWindowStatusEnum('status').default('scheduled').notNull(),
    assignedMemberId: uuid('assigned_member_id').references(() => plantationMembers.id, {
      onDelete: 'restrict',
    }),
    auditId: uuid('audit_id'),
    missedAt: timestamp('missed_at', { withTimezone: true }),
    notifiedAt: timestamp('notified_at', { withTimezone: true }),
    waiverReason: text('waiver_reason'),
    waivedBy: uuid('waived_by').references(() => plantationMembers.id, {
      onDelete: 'restrict',
    }),
    waivedAt: timestamp('waived_at', { withTimezone: true }),
  },
  (table) => ({
    siteSequenceUnique: unique('plantation_audit_windows_site_sequence_unique').on(
      table.siteId,
      table.sequenceNumber,
    ),
    cronScanIdx: index('plantation_audit_windows_status_due_date_idx').on(table.status, table.dueDate),
  }),
)

export const plantationAudits = pgTable(
  'plantation_audits',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    siteId: uuid('site_id')
      .notNull()
      .references(() => plantationSites.id, { onDelete: 'restrict' }),
    windowId: uuid('window_id').references(() => plantationAuditWindows.id, { onDelete: 'set null' }),
    clientUuid: text('client_uuid').notNull().unique(),
    auditorMemberId: uuid('auditor_member_id')
      .notNull()
      .references(() => plantationMembers.id, { onDelete: 'restrict' }),
    auditedAt: timestamp('audited_at', { withTimezone: true }).notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).defaultNow().notNull(),
    accessMethod: auditAccessMethodEnum('access_method').notNull(),
    plantedCount: integer('planted_count').notNull(),
    survivingCount: integer('surviving_count').notNull(),
    missingCount: integer('missing_count')
      .notNull()
      .generatedAlwaysAs(sql`greatest(planted_count - surviving_count, 0)`),
    survivalRate: numeric('survival_rate', { precision: 5, scale: 2 })
      .notNull()
      .generatedAlwaysAs(
        sql`case when planted_count = 0 then 0 else round((surviving_count::numeric / planted_count::numeric) * 100, 2) end`,
      ),
    band: auditBandEnum('band')
      .notNull()
      .generatedAlwaysAs(sql`plantation_audit_band_for_counts(planted_count, surviving_count)`),
    latitude: numeric('latitude', { precision: 9, scale: 6 }),
    longitude: numeric('longitude', { precision: 9, scale: 6 }),
    gpsAccuracyM: numeric('gps_accuracy_m', { precision: 8, scale: 2 }),
    distanceFromSiteM: numeric('distance_from_site_m', { precision: 10, scale: 2 }),
    gpsStatus: gpsStatusEnum('gps_status').notNull(),
    photoUrls: jsonb('photo_urls').$type<string[]>().notNull(),
    remarks: text('remarks'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    siteIdx: index('plantation_audits_site_id_idx').on(table.siteId),
    windowIdx: index('plantation_audits_window_id_idx').on(table.windowId),
    clientUuidIdx: index('plantation_audits_client_uuid_idx').on(table.clientUuid),
  }),
)

export const plantationWindowEvents = pgTable(
  'plantation_window_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    windowId: uuid('window_id')
      .notNull()
      .references(() => plantationAuditWindows.id, { onDelete: 'restrict' }),
    eventType: windowEventTypeEnum('event_type').notNull(),
    detail: jsonb('detail').$type<Record<string, unknown>>().default(sql`'{}'::jsonb`).notNull(),
    actor: text('actor').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    windowIdx: index('plantation_window_events_window_id_idx').on(table.windowId),
    eventTypeIdx: index('plantation_window_events_event_type_idx').on(table.eventType),
    createdAtIdx: index('plantation_window_events_created_at_idx').on(table.createdAt.desc()),
  }),
)

export const plantationAuditSpeciesResults = pgTable(
  'plantation_audit_species_results',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    auditId: uuid('audit_id')
      .notNull()
      .references(() => plantationAudits.id, { onDelete: 'restrict' }),
    speciesName: text('species_name').notNull(),
    plantedCount: integer('planted_count').notNull(),
    survivingCount: integer('surviving_count').notNull(),
    survivalRate: numeric('survival_rate', { precision: 5, scale: 2 })
      .notNull()
      .generatedAlwaysAs(
        sql`case when planted_count = 0 then 0 else round((surviving_count::numeric / planted_count::numeric) * 100, 2) end`,
      ),
  },
  (table) => ({
    auditIdx: index('plantation_audit_species_results_audit_id_idx').on(table.auditId),
  }),
)

export const plantationStageEvents = pgTable(
  'plantation_stage_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    siteId: uuid('site_id')
      .notNull()
      .references(() => plantationSites.id, { onDelete: 'restrict' }),
    fromStage: lifecycleStageEnum('from_stage'),
    toStage: lifecycleStageEnum('to_stage').notNull(),
    actor: text('actor').notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    siteCreatedAtIdx: index('plantation_stage_events_site_id_created_at_idx').on(
      table.siteId,
      table.createdAt.desc(),
    ),
  }),
)

export const plantationEvidence = pgTable(
  'plantation_evidence',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    siteId: uuid('site_id')
      .notNull()
      .references(() => plantationSites.id, { onDelete: 'restrict' }),
    stage: lifecycleStageEnum('stage').notNull(),
    auditId: uuid('audit_id').references(() => plantationAudits.id, { onDelete: 'restrict' }),
    url: text('url').notNull(),
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).defaultNow().notNull(),
    latitude: numeric('latitude', { precision: 9, scale: 6 }),
    longitude: numeric('longitude', { precision: 9, scale: 6 }),
    gpsAccuracy: numeric('gps_accuracy', { precision: 8, scale: 2 }),
    caption: text('caption'),
    uploadedBy: uuid('uploaded_by')
      .notNull()
      .references(() => plantationMembers.id, { onDelete: 'restrict' }),
  },
  (table) => ({
    siteStageIdx: index('plantation_evidence_site_stage_idx').on(table.siteId, table.stage),
    auditIdx: index('plantation_evidence_audit_id_idx').on(table.auditId),
  }),
)

export const plantationAcceptances = pgTable('plantation_acceptances', {
  id: uuid('id').defaultRandom().primaryKey(),
  siteId: uuid('site_id')
    .notNull()
    .references(() => plantationSites.id, { onDelete: 'restrict' })
    .unique(),
  submittedBy: uuid('submitted_by')
    .notNull()
    .references(() => plantationMembers.id, { onDelete: 'restrict' }),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).defaultNow().notNull(),
  acceptedBy: uuid('accepted_by').references(() => plantationMembers.id, {
    onDelete: 'restrict',
  }),
  acceptedRole: acceptanceRoleEnum('accepted_role'),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  acceptedSnapshot: jsonb('accepted_snapshot').$type<Record<string, unknown>>(),
})
