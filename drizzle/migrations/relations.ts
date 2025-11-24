import { relations } from "drizzle-orm/relations";
import { projects, processingJobs, shorts, users, subscriptions, transcriptions } from "./schema";

export const processingJobsRelations = relations(processingJobs, ({one}) => ({
	project: one(projects, {
		fields: [processingJobs.projectId],
		references: [projects.id]
	}),
	short: one(shorts, {
		fields: [processingJobs.shortId],
		references: [shorts.id]
	}),
}));

export const projectsRelations = relations(projects, ({one, many}) => ({
	processingJobs: many(processingJobs),
	user: one(users, {
		fields: [projects.userId],
		references: [users.id]
	}),
	transcriptions: many(transcriptions),
	shorts: many(shorts),
}));

export const shortsRelations = relations(shorts, ({one, many}) => ({
	processingJobs: many(processingJobs),
	project: one(projects, {
		fields: [shorts.projectId],
		references: [projects.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	projects: many(projects),
	subscriptions: many(subscriptions),
}));

export const subscriptionsRelations = relations(subscriptions, ({one}) => ({
	user: one(users, {
		fields: [subscriptions.userId],
		references: [users.id]
	}),
}));

export const transcriptionsRelations = relations(transcriptions, ({one}) => ({
	project: one(projects, {
		fields: [transcriptions.projectId],
		references: [projects.id]
	}),
}));