import { relations } from 'drizzle-orm';
import {
  users,
  organizations,
  projects,
  transcriptions,
  processingJobs,
  creditTransactions,
  mediaAssets,
} from './schema';

/**
 * Define relationships between tables for better querying
 * This enables Drizzle's relational query API
 */

export const usersRelations = relations(users, ({ one }) => ({
  defaultOrganization: one(organizations, {
    fields: [users.defaultOrganizationId],
    references: [organizations.id],
  }),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  projects: many(projects),
  creditTransactions: many(creditTransactions),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [projects.organizationId],
    references: [organizations.id],
  }),
  createdBy: one(users, {
    fields: [projects.createdById],
    references: [users.id],
  }),
  transcription: one(transcriptions),
  mediaAssets: many(mediaAssets),
  processingJobs: many(processingJobs),
}));

export const transcriptionsRelations = relations(transcriptions, ({ one }) => ({
  project: one(projects, {
    fields: [transcriptions.projectId],
    references: [projects.id],
  }),
}));

export const mediaAssetsRelations = relations(mediaAssets, ({ one }) => ({
  project: one(projects, {
    fields: [mediaAssets.projectId],
    references: [projects.id],
  }),
  sourceAsset: one(mediaAssets, {
    fields: [mediaAssets.sourceAssetId],
    references: [mediaAssets.id],
  }),
}));

export const processingJobsRelations = relations(processingJobs, ({ one }) => ({
  project: one(projects, {
    fields: [processingJobs.projectId],
    references: [projects.id],
  }),
}));

export const creditTransactionsRelations = relations(creditTransactions, ({ one }) => ({
  organization: one(organizations, {
    fields: [creditTransactions.organizationId],
    references: [organizations.id],
  }),
  performedBy: one(users, {
    fields: [creditTransactions.performedById],
    references: [users.id],
  }),
}));
