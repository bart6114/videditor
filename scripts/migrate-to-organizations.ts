/**
 * Data Migration Script: Migrate existing users to organization-based model
 *
 * This script:
 * 1. Creates a personal organization for each existing user
 * 2. Adds the user as owner of their organization
 * 3. Sets the organization as the user's default
 * 4. Migrates all projects to the organization
 * 5. Migrates all subscriptions to the organization
 * 6. Migrates all credit transactions to the organization
 *
 * Run with: npx tsx scripts/migrate-to-organizations.ts
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { eq, isNull, sql } from 'drizzle-orm';
import * as schema from '../db/schema';
import crypto from 'crypto';

const {
  users,
  organizations,
  organizationMembers,
  projects,
  subscriptions,
  creditTransactions,
} = schema;

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });

  console.log('Starting organization migration...\n');

  // Get all users
  const allUsers = await db.select().from(users);
  console.log(`Found ${allUsers.length} users to migrate\n`);

  let migratedCount = 0;
  let skippedCount = 0;

  for (const user of allUsers) {
    // Check if user already has a default organization
    if (user.defaultOrganizationId) {
      console.log(`Skipping user ${user.id} - already has default organization`);
      skippedCount++;
      continue;
    }

    const orgId = `org_${crypto.randomUUID()}`;
    const memberId = `mem_${crypto.randomUUID()}`;
    const orgName = user.fullName
      ? `${user.fullName}'s Workspace`
      : user.email
        ? `${user.email.split('@')[0]}'s Workspace`
        : 'Personal Workspace';

    // Generate a unique slug from the org name
    const baseSlug = orgName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .substring(0, 50);
    const slug = `${baseSlug}-${crypto.randomUUID().slice(0, 8)}`;

    console.log(`Migrating user ${user.id}:`);
    console.log(`  Creating organization: ${orgName} (${orgId})`);

    // 1. Create organization with billing data from user
    await db.insert(organizations).values({
      id: orgId,
      name: orgName,
      slug,
      credits: user.credits,
      stripeCustomerId: user.stripeCustomerId,
      autoTopUpEnabled: user.autoTopUpEnabled,
      autoTopUpThreshold: user.autoTopUpThreshold,
      autoTopUpAmount: user.autoTopUpAmount,
    });

    // 2. Add user as owner
    await db.insert(organizationMembers).values({
      id: memberId,
      organizationId: orgId,
      userId: user.id,
      role: 'owner',
    });

    // 3. Set user's default organization
    await db
      .update(users)
      .set({ defaultOrganizationId: orgId })
      .where(eq(users.id, user.id));

    // 4. Migrate user's projects
    const projectsUpdated = await db
      .update(projects)
      .set({
        organizationId: orgId,
        createdById: user.id,
      })
      .where(eq(projects.userId, user.id));

    // Count projects updated
    const userProjects = await db
      .select({ count: sql<number>`count(*)` })
      .from(projects)
      .where(eq(projects.organizationId, orgId));
    console.log(`  Migrated ${userProjects[0]?.count || 0} projects`);

    // 5. Migrate user's subscriptions
    await db
      .update(subscriptions)
      .set({ organizationId: orgId })
      .where(eq(subscriptions.userId, user.id));

    // 6. Migrate user's credit transactions
    await db
      .update(creditTransactions)
      .set({
        organizationId: orgId,
        performedById: user.id,
      })
      .where(eq(creditTransactions.userId, user.id));

    const userTransactions = await db
      .select({ count: sql<number>`count(*)` })
      .from(creditTransactions)
      .where(eq(creditTransactions.organizationId, orgId));
    console.log(`  Migrated ${userTransactions[0]?.count || 0} credit transactions`);

    migratedCount++;
    console.log('');
  }

  console.log('Migration complete!');
  console.log(`  Migrated: ${migratedCount} users`);
  console.log(`  Skipped: ${skippedCount} users (already had organizations)`);

  // Verify migration
  console.log('\nVerification:');

  const usersWithoutOrg = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(isNull(users.defaultOrganizationId));
  console.log(`  Users without default org: ${usersWithoutOrg[0]?.count || 0}`);

  const projectsWithoutOrg = await db
    .select({ count: sql<number>`count(*)` })
    .from(projects)
    .where(isNull(projects.organizationId));
  console.log(`  Projects without org: ${projectsWithoutOrg[0]?.count || 0}`);

  const totalOrgs = await db
    .select({ count: sql<number>`count(*)` })
    .from(organizations);
  console.log(`  Total organizations: ${totalOrgs[0]?.count || 0}`);

  await pool.end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
