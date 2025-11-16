import { relations } from 'drizzle-orm';
import {
  users,
  subscriptions,
  projects,
  transcriptions,
  shorts,
  processingJobs,
} from './schema';

/**
 * Define relationships between tables for better querying
 * This enables Drizzle's relational query API
 */

export const usersRelations = relations(users, ({ many }) => ({
  subscriptions: many(subscriptions),
  projects: many(projects),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),
  transcription: one(transcriptions),
  shorts: many(shorts),
  processingJobs: many(processingJobs),
}));

export const transcriptionsRelations = relations(transcriptions, ({ one }) => ({
  project: one(projects, {
    fields: [transcriptions.projectId],
    references: [projects.id],
  }),
}));

export const shortsRelations = relations(shorts, ({ one }) => ({
  project: one(projects, {
    fields: [shorts.projectId],
    references: [projects.id],
  }),
}));

export const processingJobsRelations = relations(processingJobs, ({ one }) => ({
  project: one(projects, {
    fields: [processingJobs.projectId],
    references: [projects.id],
  }),
}));
