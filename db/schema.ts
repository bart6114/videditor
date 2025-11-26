import { sql } from 'drizzle-orm';
import {
  pgEnum,
  pgTable,
  text,
  varchar,
  timestamp,
  boolean,
  bigint,
  jsonb,
  index,
  doublePrecision,
  real,
  integer,
  unique,
} from 'drizzle-orm/pg-core';

export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'active',
  'canceled',
  'past_due',
  'trialing',
  'incomplete',
]);

export const projectStatusEnum = pgEnum('project_status', [
  'uploading',
  'ready',
  'queued',
  'processing',
  'transcribing',
  'analyzing',
  'completed',
  'error',
]);

export const shortStatusEnum = pgEnum('short_status', ['pending', 'processing', 'completed', 'error']);

export const jobTypeEnum = pgEnum('job_type', [
  'thumbnail',
  'transcription',
  'analysis',
]);

export const jobStatusEnum = pgEnum('job_status', ['queued', 'running', 'succeeded', 'failed', 'canceled']);

export const creditTransactionTypeEnum = pgEnum('credit_transaction_type', [
  'purchase',      // Manual purchase
  'auto_topup',    // Automatic top-up
  'usage',         // Credit spent on job
  'refund',        // Refund (failed job)
  'adjustment',    // Manual admin adjustment
]);

export const memberRoleEnum = pgEnum('member_role', ['owner', 'member']);

// ============================================================================
// ORGANIZATIONS
// ============================================================================

export const organizations = pgTable(
  'organizations',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).unique(),
    // Billing fields (moved from users)
    credits: integer('credits').default(50).notNull(),
    stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
    autoTopUpEnabled: boolean('auto_top_up_enabled').default(false).notNull(),
    autoTopUpThreshold: integer('auto_top_up_threshold').default(5),
    autoTopUpAmount: integer('auto_top_up_amount').default(10),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    slugIdx: index('idx_organizations_slug').on(table.slug),
    stripeCustomerIdIdx: index('idx_organizations_stripe_customer_id').on(table.stripeCustomerId),
  })
);

export const organizationMembers = pgTable(
  'organization_members',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    organizationId: varchar('organization_id', { length: 255 })
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: memberRoleEnum('role').notNull().default('member'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgIdIdx: index('idx_organization_members_org_id').on(table.organizationId),
    userIdIdx: index('idx_organization_members_user_id').on(table.userId),
    uniqueMembership: unique('unique_org_member').on(table.organizationId, table.userId),
  })
);

export const organizationInvites = pgTable(
  'organization_invites',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    organizationId: varchar('organization_id', { length: 255 })
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    code: varchar('code', { length: 32 }).unique().notNull(),
    createdById: varchar('created_by_id', { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usageCount: integer('usage_count').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    codeIdx: index('idx_organization_invites_code').on(table.code),
    orgIdIdx: index('idx_organization_invites_org_id').on(table.organizationId),
    expiresAtIdx: index('idx_organization_invites_expires_at').on(table.expiresAt),
  })
);

export const users = pgTable(
  'users',
  {
    id: varchar('id', { length: 255 }).primaryKey(), // Clerk user ID
    email: varchar('email', { length: 255 }).unique(),
    fullName: varchar('full_name', { length: 255 }),
    imageUrl: text('image_url'),
    defaultCustomPrompt: text('default_custom_prompt'), // Default AI instruction for shorts generation
    defaultSocialPlatforms: jsonb('default_social_platforms').$type<string[]>().default(sql`'[]'::jsonb`), // Default platforms for social content generation
    defaultAvoidOverlap: boolean('default_avoid_overlap').default(false), // Default setting for avoiding overlap with existing shorts
    defaultPreferredLength: integer('default_preferred_length').default(45), // Default preferred short length in seconds (15-120)
    defaultMaxLength: integer('default_max_length').default(60), // Default maximum short length in seconds (15-120)
    // Organization - user's currently active organization
    defaultOrganizationId: varchar('default_organization_id', { length: 255 })
      .references(() => organizations.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: index('idx_users_email').on(table.email),
    defaultOrgIdIdx: index('idx_users_default_organization_id').on(table.defaultOrganizationId),
  })
);

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    organizationId: varchar('organization_id', { length: 255 })
      .references(() => organizations.id, { onDelete: 'cascade' }),
    stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
    stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }),
    stripePriceId: varchar('stripe_price_id', { length: 255 }),
    status: subscriptionStatusEnum('status').notNull(),
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    organizationIdIdx: index('idx_subscriptions_organization_id').on(table.organizationId),
    stripeCustomerIdIdx: index('idx_subscriptions_stripe_customer_id').on(table.stripeCustomerId),
    stripeSubscriptionIdIdx: index('idx_subscriptions_subscription_id').on(table.stripeSubscriptionId),
  })
);

export const projects = pgTable(
  'projects',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    organizationId: varchar('organization_id', { length: 255 })
      .references(() => organizations.id, { onDelete: 'cascade' }),
    createdById: varchar('created_by_id', { length: 255 })
      .references(() => users.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    sourceObjectKey: text('source_object_key').notNull(),
    sourceBucket: text('source_bucket').notNull(),
    thumbnailUrl: text('thumbnail_url'),
    durationSeconds: doublePrecision('duration_seconds'),
    fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }),
    status: projectStatusEnum('status').notNull().default('uploading'),
    priority: real('priority').default(0),
    errorMessage: text('error_message'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => ({
    organizationIdIdx: index('idx_projects_organization_id').on(table.organizationId),
    statusIdx: index('idx_projects_status').on(table.status),
    createdAtIdx: index('idx_projects_created_at').on(table.createdAt),
  })
);

export const transcriptions = pgTable(
  'transcriptions',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    projectId: varchar('project_id', { length: 255 })
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    text: text('text').notNull(),
    segments: jsonb('segments')
      .$type<Record<string, unknown>[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    language: varchar('language', { length: 16 }),
    durationSeconds: doublePrecision('duration_seconds'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index('idx_transcriptions_project_id').on(table.projectId),
  })
);

export const shorts = pgTable(
  'shorts',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    projectId: varchar('project_id', { length: 255 })
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    transcriptionSlice: text('transcription_slice').notNull(),
    startTime: doublePrecision('start_time').notNull(),
    endTime: doublePrecision('end_time').notNull(),
    outputObjectKey: text('output_object_key'),
    thumbnailUrl: text('thumbnail_url'),
    status: shortStatusEnum('status').notNull().default('pending'),
    errorMessage: text('error_message'),
    metadata: jsonb('metadata'),
    socialContent: jsonb('social_content'), // Generated social media content per platform
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index('idx_shorts_project_id').on(table.projectId),
    statusIdx: index('idx_shorts_status').on(table.status),
  })
);

export const processingJobs = pgTable(
  'processing_jobs',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    projectId: varchar('project_id', { length: 255 })
      .references(() => projects.id, { onDelete: 'cascade' }),
    shortId: varchar('short_id', { length: 255 }).references(() => shorts.id, { onDelete: 'cascade' }),
    type: jobTypeEnum('type').notNull(),
    status: jobStatusEnum('status').notNull().default('queued'),
    payload: jsonb('payload'),
    result: jsonb('result'),
    errorMessage: text('error_message'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index('idx_processing_jobs_project_id').on(table.projectId),
    jobStatusIdx: index('idx_processing_jobs_status').on(table.status),
    jobTypeIdx: index('idx_processing_jobs_type').on(table.type),
  })
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

export type Transcription = typeof transcriptions.$inferSelect;
export type NewTranscription = typeof transcriptions.$inferInsert;

export type Short = typeof shorts.$inferSelect;
export type NewShort = typeof shorts.$inferInsert;

export type ProcessingJob = typeof processingJobs.$inferSelect;
export type NewProcessingJob = typeof processingJobs.$inferInsert;

export const creditTransactions = pgTable(
  'credit_transactions',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    organizationId: varchar('organization_id', { length: 255 })
      .references(() => organizations.id, { onDelete: 'cascade' }),
    performedById: varchar('performed_by_id', { length: 255 })
      .references(() => users.id, { onDelete: 'set null' }),
    type: creditTransactionTypeEnum('type').notNull(),
    amount: integer('amount').notNull(),           // Positive for additions, negative for deductions
    balanceAfter: integer('balance_after').notNull(),
    description: text('description'),
    stripePaymentIntentId: varchar('stripe_payment_intent_id', { length: 255 }),
    metadata: jsonb('metadata'),                   // Job ID, project ID, etc.
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    organizationIdIdx: index('idx_credit_transactions_organization_id').on(table.organizationId),
    typeIdx: index('idx_credit_transactions_type').on(table.type),
    createdAtIdx: index('idx_credit_transactions_created_at').on(table.createdAt),
  })
);

export type CreditTransaction = typeof creditTransactions.$inferSelect;
export type NewCreditTransaction = typeof creditTransactions.$inferInsert;

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;

export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type NewOrganizationMember = typeof organizationMembers.$inferInsert;

export type OrganizationInvite = typeof organizationInvites.$inferSelect;
export type NewOrganizationInvite = typeof organizationInvites.$inferInsert;
