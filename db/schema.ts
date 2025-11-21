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
  'rendering',
  'delivering',
  'completed',
  'error',
]);

export const shortStatusEnum = pgEnum('short_status', ['pending', 'processing', 'completed', 'error']);

export const jobTypeEnum = pgEnum('job_type', [
  'thumbnail',
  'transcription',
  'analysis',
  'cutting',
  'delivery',
]);

export const jobStatusEnum = pgEnum('job_status', ['queued', 'running', 'succeeded', 'failed', 'canceled']);

export const users = pgTable(
  'users',
  {
    id: varchar('id', { length: 255 }).primaryKey(), // Clerk user ID
    email: varchar('email', { length: 255 }).unique(),
    fullName: varchar('full_name', { length: 255 }),
    imageUrl: text('image_url'),
    defaultCustomPrompt: text('default_custom_prompt'), // Default AI instruction for shorts generation
    defaultSocialPlatforms: jsonb('default_social_platforms').$type<string[]>().default(sql`'[]'::jsonb`), // Default platforms for social content generation
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: index('idx_users_email').on(table.email),
  })
);

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
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
    userIdIdx: index('idx_subscriptions_user_id').on(table.userId),
    stripeCustomerIdIdx: index('idx_subscriptions_stripe_customer_id').on(table.stripeCustomerId),
    stripeSubscriptionIdIdx: index('idx_subscriptions_subscription_id').on(table.stripeSubscriptionId),
  })
);

export const projects = pgTable(
  'projects',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
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
    userIdIdx: index('idx_projects_user_id').on(table.userId),
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
