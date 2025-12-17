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
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

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
  'short_processing',
  'youtube_publish',
  'instagram_publish',
]);

export const socialPlatformEnum = pgEnum('social_platform', ['youtube', 'tiktok', 'instagram']);

export const scheduledPostStatusEnum = pgEnum('scheduled_post_status', [
  'scheduled',    // Waiting for scheduled time
  'publishing',   // Currently being published
  'published',    // Successfully published
  'failed',       // Publishing failed
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

export const inboxMessageTypeEnum = pgEnum('inbox_message_type', ['error', 'info', 'announcement']);

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
    credits: integer('credits').default(100).notNull(),
    stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
    autoTopUpEnabled: boolean('auto_top_up_enabled').default(false).notNull(),
    autoTopUpThreshold: integer('auto_top_up_threshold').default(5),
    autoTopUpAmount: integer('auto_top_up_amount').default(10),
    preferredCurrency: varchar('preferred_currency', { length: 3 }), // 'EUR' or 'USD' - null means auto-detect on first visit
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
    defaultSocialPrompt: text('default_social_prompt'), // Default AI instruction for social content generation
    defaultSocialPlatforms: jsonb('default_social_platforms').$type<string[]>().default(sql`'["youtube", "instagram", "tiktok", "linkedin"]'::jsonb`), // Default platforms for social content generation
    defaultAvoidOverlap: boolean('default_avoid_overlap').default(true), // Default setting for avoiding overlap with existing shorts
    defaultPreferredLength: integer('default_preferred_length').default(45), // Default preferred short length in seconds (15-120)
    defaultMaxLength: integer('default_max_length').default(60), // Default maximum short length in seconds (15-120)
    defaultSchedulingPrompt: text('default_scheduling_prompt'), // Default prompt for bulk scheduling
    // Onboarding - tracks which tours user has completed (e.g., { "projects_overview": true, "project_detail": true })
    completedTours: jsonb('completed_tours').$type<Record<string, boolean>>().default(sql`'{}'::jsonb`),
    // Organization - user's currently active organization
    defaultOrganizationId: varchar('default_organization_id', { length: 255 })
      .references(() => organizations.id, { onDelete: 'set null' }),
    // Admin flag for system-wide admin access
    isAdmin: boolean('is_admin').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: index('idx_users_email').on(table.email),
    defaultOrgIdIdx: index('idx_users_default_organization_id').on(table.defaultOrganizationId),
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
      .$type<Array<{
        start: number;
        end: number;
        text: string;
        speaker: string | null;
      }>>()
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
    analysisJobId: varchar('analysis_job_id', { length: 255 })
      .references((): AnyPgColumn => processingJobs.id, { onDelete: 'set null' }),
    transcriptionSlice: text('transcription_slice').notNull(),
    startTime: doublePrecision('start_time').notNull(),
    endTime: doublePrecision('end_time').notNull(),
    outputObjectKey: text('output_object_key'),
    thumbnailUrl: text('thumbnail_url'),
    status: shortStatusEnum('status').notNull().default('pending'),
    errorMessage: text('error_message'),
    metadata: jsonb('metadata'),
    socialContent: jsonb('social_content'), // Generated social media content per platform
    tasks: jsonb('tasks').$type<{
      clip_extraction: 'pending' | 'processing' | 'done' | 'error';
      thumbnail_extraction: 'pending' | 'processing' | 'done' | 'error';
      social_content: 'pending' | 'processing' | 'done' | 'error' | 'skipped';
    }>(),
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
    shortId: varchar('short_id', { length: 255 }).references((): AnyPgColumn => shorts.id, { onDelete: 'cascade' }),
    type: jobTypeEnum('type').notNull(),
    status: jobStatusEnum('status').notNull().default('queued'),
    payload: jsonb('payload'),
    result: jsonb('result'),
    progress: jsonb('progress').$type<{ phase: 'transcribing' | 'analyzing' | 'generating'; current: number; total: number }>(),
    errorMessage: text('error_message'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    // Job affinity fields for cache optimization
    preferredMachineId: varchar('preferred_machine_id', { length: 255 }),
    claimedByMachineId: varchar('claimed_by_machine_id', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index('idx_processing_jobs_project_id').on(table.projectId),
    jobStatusIdx: index('idx_processing_jobs_status').on(table.status),
    jobTypeIdx: index('idx_processing_jobs_type').on(table.type),
    preferredMachineIdIdx: index('idx_processing_jobs_preferred_machine_id').on(table.preferredMachineId),
  })
);

// ============================================================================
// PROJECT MACHINE AFFINITY (Job routing optimization for video cache)
// ============================================================================

export const projectMachineAffinity = pgTable(
  'project_machine_affinity',
  {
    projectId: varchar('project_id', { length: 255 })
      .primaryKey()
      .references(() => projects.id, { onDelete: 'cascade' }),
    machineId: varchar('machine_id', { length: 255 }).notNull(),
    lastProcessedAt: timestamp('last_processed_at', { withTimezone: true }).defaultNow().notNull(),
    jobCount: integer('job_count').default(1).notNull(),
  },
  (table) => ({
    machineIdIdx: index('idx_project_machine_affinity_machine_id').on(table.machineId),
    lastProcessedAtIdx: index('idx_project_machine_affinity_last_processed_at').on(table.lastProcessedAt),
  })
);

export type ProjectMachineAffinity = typeof projectMachineAffinity.$inferSelect;
export type NewProjectMachineAffinity = typeof projectMachineAffinity.$inferInsert;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

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
    // Currency tracking for purchases
    currency: varchar('currency', { length: 3 }),  // 'EUR' or 'USD' (null for usage/refund/adjustment)
    amountCents: integer('amount_cents'),          // Price paid in currency cents (null for non-purchase)
    exchangeRate: doublePrecision('exchange_rate'), // EUR/USD rate at time of purchase
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

// ============================================================================
// SOCIAL ACCOUNTS (Organization-level connected social media accounts)
// ============================================================================

export const socialAccounts = pgTable(
  'social_accounts',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    organizationId: varchar('organization_id', { length: 255 })
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    platform: socialPlatformEnum('platform').notNull(),
    // YouTube-specific fields
    channelId: varchar('channel_id', { length: 255 }),
    channelTitle: varchar('channel_title', { length: 255 }),
    channelThumbnail: text('channel_thumbnail'),
    // OAuth tokens
    accessToken: text('access_token').notNull(),
    refreshToken: text('refresh_token').notNull(),
    tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }).notNull(),
    scopes: jsonb('scopes').$type<string[]>().default(sql`'[]'::jsonb`),
    // Audit fields
    connectedById: varchar('connected_by_id', { length: 255 })
      .references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgPlatformIdx: index('idx_social_accounts_org_platform').on(table.organizationId, table.platform),
    uniqueOrgPlatform: unique('unique_org_platform').on(table.organizationId, table.platform),
  })
);

export type SocialAccount = typeof socialAccounts.$inferSelect;
export type NewSocialAccount = typeof socialAccounts.$inferInsert;

// ============================================================================
// SCHEDULED POSTS (Scheduled social media publishing)
// ============================================================================

export const scheduledPosts = pgTable(
  'scheduled_posts',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    organizationId: varchar('organization_id', { length: 255 })
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    shortId: varchar('short_id', { length: 255 })
      .notNull()
      .references(() => shorts.id, { onDelete: 'cascade' }),
    socialAccountId: varchar('social_account_id', { length: 255 })
      .references(() => socialAccounts.id, { onDelete: 'set null' }),
    // Platform is stored directly so we know which platform even if account is disconnected
    platform: socialPlatformEnum('platform').notNull(),
    // Scheduling
    scheduledFor: timestamp('scheduled_for', { withTimezone: true }).notNull(),
    status: scheduledPostStatusEnum('status').notNull().default('scheduled'),
    // Content to publish (snapshot at schedule time)
    title: text('title').notNull(),
    description: text('description'),
    // Publishing result
    platformPostId: varchar('platform_post_id', { length: 255 }), // YouTube video ID
    platformUrl: text('platform_url'), // YouTube URL after publish
    errorMessage: text('error_message'),
    retryCount: integer('retry_count').default(0).notNull(),
    // Audit fields
    scheduledById: varchar('scheduled_by_id', { length: 255 })
      .references(() => users.id, { onDelete: 'set null' }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgIdIdx: index('idx_scheduled_posts_org_id').on(table.organizationId),
    shortIdIdx: index('idx_scheduled_posts_short_id').on(table.shortId),
    statusScheduledIdx: index('idx_scheduled_posts_status_scheduled').on(table.status, table.scheduledFor),
    scheduledForIdx: index('idx_scheduled_posts_scheduled_for').on(table.scheduledFor),
  })
);

export type ScheduledPost = typeof scheduledPosts.$inferSelect;
export type NewScheduledPost = typeof scheduledPosts.$inferInsert;

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;

export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type NewOrganizationMember = typeof organizationMembers.$inferInsert;

export type OrganizationInvite = typeof organizationInvites.$inferSelect;
export type NewOrganizationInvite = typeof organizationInvites.$inferInsert;

// ============================================================================
// INBOX MESSAGES (User notifications)
// ============================================================================

export const inboxMessages = pgTable(
  'inbox_messages',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: inboxMessageTypeEnum('type').notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    body: text('body').notNull(),
    actionUrl: varchar('action_url', { length: 2048 }),
    actionLabel: varchar('action_label', { length: 100 }),
    isRead: boolean('is_read').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    readAt: timestamp('read_at', { withTimezone: true }),
  },
  (table) => ({
    userIdIdx: index('idx_inbox_messages_user_id').on(table.userId),
    userUnreadIdx: index('idx_inbox_messages_user_unread').on(table.userId, table.isRead),
    createdAtIdx: index('idx_inbox_messages_created_at').on(table.createdAt),
  })
);

export type InboxMessage = typeof inboxMessages.$inferSelect;
export type NewInboxMessage = typeof inboxMessages.$inferInsert;
