import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ================================================================================
// USERS TABLE - Clerk authentication sync
// ================================================================================

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(), // Clerk user ID
    email: text('email').notNull().unique(),
    fullName: text('full_name'),
    imageUrl: text('image_url'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    emailIdx: index('idx_users_email').on(table.email),
  })
);

// ================================================================================
// SUBSCRIPTIONS TABLE - Stripe subscription management
// ================================================================================

export const subscriptions = sqliteTable(
  'subscriptions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    stripeCustomerId: text('stripe_customer_id'),
    stripeSubscriptionId: text('stripe_subscription_id'),
    stripePriceId: text('stripe_price_id'),
    status: text('status', {
      enum: ['active', 'canceled', 'past_due', 'trialing', 'incomplete'],
    }).notNull(),
    currentPeriodStart: text('current_period_start'),
    currentPeriodEnd: text('current_period_end'),
    cancelAtPeriodEnd: integer('cancel_at_period_end', { mode: 'boolean' }).default(false),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    userIdIdx: index('idx_subscriptions_user_id').on(table.userId),
    stripeCustomerIdIdx: index('idx_subscriptions_stripe_customer_id').on(table.stripeCustomerId),
  })
);

// ================================================================================
// PROJECTS TABLE - Video metadata and processing status
// ================================================================================

export const projects = sqliteTable(
  'projects',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    videoUid: text('video_uid').notNull(), // Cloudflare Stream video UID
    thumbnailUrl: text('thumbnail_url'),
    duration: real('duration'), // seconds as decimal (nullable until Stream processes)
    fileSize: integer('file_size'), // bytes (nullable until Stream processes)
    status: text('status', {
      enum: ['uploading', 'processing', 'transcribing', 'analyzing', 'completed', 'error'],
    }).notNull(),
    errorMessage: text('error_message'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    userIdIdx: index('idx_projects_user_id').on(table.userId),
    statusIdx: index('idx_projects_status').on(table.status),
    createdAtIdx: index('idx_projects_created_at').on(table.createdAt),
  })
);

// ================================================================================
// TRANSCRIPTIONS TABLE - Whisper AI transcription results
// ================================================================================

export const transcriptions = sqliteTable(
  'transcriptions',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    text: text('text').notNull(), // Full transcript text
    segments: text('segments').notNull(), // JSON array of timestamped segments
    language: text('language'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    projectIdIdx: index('idx_transcriptions_project_id').on(table.projectId),
  })
);

// ================================================================================
// SHORTS TABLE - AI-suggested viral clip moments
// ================================================================================

export const shorts = sqliteTable(
  'shorts',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description').notNull(),
    startTime: real('start_time').notNull(), // seconds
    endTime: real('end_time').notNull(), // seconds
    videoUrl: text('video_url'), // Cloudflare Stream clip URL
    streamClipId: text('stream_clip_id'), // Cloudflare Stream clip ID
    thumbnailUrl: text('thumbnail_url'),
    status: text('status', {
      enum: ['pending', 'processing', 'completed', 'error'],
    }).notNull(),
    errorMessage: text('error_message'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    projectIdIdx: index('idx_shorts_project_id').on(table.projectId),
    statusIdx: index('idx_shorts_status').on(table.status),
  })
);

// ================================================================================
// PROCESSING_JOBS TABLE - Background job queue tracking
// ================================================================================

export const processingJobs = sqliteTable(
  'processing_jobs',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    type: text('type', {
      enum: ['transcription', 'analysis', 'video_cut', 'stream_upload'],
    }).notNull(),
    status: text('status', {
      enum: ['pending', 'processing', 'completed', 'error'],
    }).notNull(),
    progress: real('progress').default(0.0), // 0.0 to 100.0
    errorMessage: text('error_message'),
    metadata: text('metadata'), // JSON metadata as text
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    projectIdIdx: index('idx_processing_jobs_project_id').on(table.projectId),
    statusIdx: index('idx_processing_jobs_status').on(table.status),
    typeIdx: index('idx_processing_jobs_type').on(table.type),
  })
);

// ================================================================================
// TYPE EXPORTS - For use with InferSelectModel and InferInsertModel
// ================================================================================

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
