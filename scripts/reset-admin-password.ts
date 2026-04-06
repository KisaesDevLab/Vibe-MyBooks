import bcrypt from 'bcrypt';
import { db } from '../packages/api/src/db/index.js';
import { users } from '../packages/api/src/db/schema/index.js';
import { eq } from 'drizzle-orm';
import { auditLog } from '../packages/api/src/db/schema/index.js';

const email = process.argv[2];
const newPassword = process.argv[3];

if (!email || !newPassword) {
  console.log('Usage: npx tsx scripts/reset-admin-password.ts <email> <new-password>');
  console.log('Example: npx tsx scripts/reset-admin-password.ts admin@example.com NewP@ssw0rd123');
  process.exit(1);
}

async function resetPassword() {
  const user = await db.query.users.findFirst({ where: eq(users.email, email!) });
  if (!user) {
    console.error(`User not found: ${email}`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(newPassword!, 12);
  await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, user.id));

  // Audit log
  await db.insert(auditLog).values({
    tenantId: user.tenantId,
    userId: user.id,
    action: 'update',
    entityType: 'user',
    entityId: user.id,
    afterData: JSON.stringify({ passwordReset: true, email }),
  });

  console.log(`✅ Password reset for ${email}`);
  console.log('The user can now log in with the new password.');
  process.exit(0);
}

resetPassword().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
