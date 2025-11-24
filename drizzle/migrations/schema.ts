import { pgTable, index, foreignKey, varchar, jsonb, text, timestamp, doublePrecision, bigint, real, boolean, unique, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const jobStatus = pgEnum("job_status", ['queued', 'running', 'succeeded', 'failed', 'canceled'])
export const jobType = pgEnum("job_type", ['thumbnail', 'transcription', 'analysis', 'cutting', 'delivery'])
export const projectStatus = pgEnum("project_status", ['uploading', 'ready', 'queued', 'processing', 'transcribing', 'analyzing', 'rendering', 'delivering', 'completed', 'error'])
export const shortStatus = pgEnum("short_status", ['pending', 'processing', 'completed', 'error'])
export const subscriptionStatus = pgEnum("subscription_status", ['active', 'canceled', 'past_due', 'trialing', 'incomplete'])


export const processingJobs = pgTable("processing_jobs", {
	id: varchar({ length: 255 }).primaryKey().notNull(),
	projectId: varchar("project_id", { length: 255 }),
	shortId: varchar("short_id", { length: 255 }),
	type: jobType().notNull(),
	status: jobStatus().default('queued').notNull(),
	payload: jsonb(),
	result: jsonb(),
	errorMessage: text("error_message"),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_processing_jobs_project_id").using("btree", table.projectId.asc().nullsLast().op("text_ops")),
	index("idx_processing_jobs_status").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	index("idx_processing_jobs_type").using("btree", table.type.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "processing_jobs_project_id_projects_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.shortId],
			foreignColumns: [shorts.id],
			name: "processing_jobs_short_id_shorts_id_fk"
		}).onDelete("cascade"),
]);

export const projects = pgTable("projects", {
	id: varchar({ length: 255 }).primaryKey().notNull(),
	userId: varchar("user_id", { length: 255 }).notNull(),
	title: text().notNull(),
	sourceObjectKey: text("source_object_key").notNull(),
	sourceBucket: text("source_bucket").notNull(),
	thumbnailUrl: text("thumbnail_url"),
	durationSeconds: doublePrecision("duration_seconds"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	fileSizeBytes: bigint("file_size_bytes", { mode: "number" }),
	status: projectStatus().default('uploading').notNull(),
	priority: real().default(0),
	errorMessage: text("error_message"),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("idx_projects_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("idx_projects_status").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	index("idx_projects_user_id").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "projects_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const subscriptions = pgTable("subscriptions", {
	id: varchar({ length: 255 }).primaryKey().notNull(),
	userId: varchar("user_id", { length: 255 }).notNull(),
	stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
	stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
	stripePriceId: varchar("stripe_price_id", { length: 255 }),
	status: subscriptionStatus().notNull(),
	currentPeriodStart: timestamp("current_period_start", { withTimezone: true, mode: 'string' }),
	currentPeriodEnd: timestamp("current_period_end", { withTimezone: true, mode: 'string' }),
	cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_subscriptions_stripe_customer_id").using("btree", table.stripeCustomerId.asc().nullsLast().op("text_ops")),
	index("idx_subscriptions_subscription_id").using("btree", table.stripeSubscriptionId.asc().nullsLast().op("text_ops")),
	index("idx_subscriptions_user_id").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "subscriptions_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const transcriptions = pgTable("transcriptions", {
	id: varchar({ length: 255 }).primaryKey().notNull(),
	projectId: varchar("project_id", { length: 255 }).notNull(),
	text: text().notNull(),
	segments: jsonb().default([]).notNull(),
	language: varchar({ length: 16 }),
	durationSeconds: doublePrecision("duration_seconds"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_transcriptions_project_id").using("btree", table.projectId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "transcriptions_project_id_projects_id_fk"
		}).onDelete("cascade"),
]);

export const users = pgTable("users", {
	id: varchar({ length: 255 }).primaryKey().notNull(),
	email: varchar({ length: 255 }),
	fullName: varchar("full_name", { length: 255 }),
	imageUrl: text("image_url"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	defaultCustomPrompt: text("default_custom_prompt"),
	defaultSocialPlatforms: jsonb("default_social_platforms").default([]),
}, (table) => [
	index("idx_users_email").using("btree", table.email.asc().nullsLast().op("text_ops")),
	unique("users_email_unique").on(table.email),
]);

export const shorts = pgTable("shorts", {
	id: varchar({ length: 255 }).primaryKey().notNull(),
	projectId: varchar("project_id", { length: 255 }).notNull(),
	startTime: doublePrecision("start_time").notNull(),
	endTime: doublePrecision("end_time").notNull(),
	outputObjectKey: text("output_object_key"),
	thumbnailUrl: text("thumbnail_url"),
	status: shortStatus().default('pending').notNull(),
	errorMessage: text("error_message"),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	transcriptionSlice: text("transcription_slice").notNull(),
	socialContent: jsonb("social_content"),
}, (table) => [
	index("idx_shorts_project_id").using("btree", table.projectId.asc().nullsLast().op("text_ops")),
	index("idx_shorts_status").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "shorts_project_id_projects_id_fk"
		}).onDelete("cascade"),
]);
