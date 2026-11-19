// server/prisma/resetAdmin.js
// Usage:
//   node prisma/resetAdmin.js list
//   node prisma/resetAdmin.js reset <email> <newPassword>

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const [command, emailArg, passwordArg] = process.argv.slice(2);

  if (command === 'list') {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, firstName: true, lastName: true, role: true },
      orderBy: { id: 'asc' },
    });
    console.table(users);
    return;
  }

  if (command === 'reset') {
    if (!emailArg || !passwordArg) {
      console.error('Usage: node prisma/resetAdmin.js reset <email> <newPassword>');
      process.exitCode = 1;
      return;
    }
    const email = emailArg.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(passwordArg, 10);

    const user = await prisma.user.upsert({
      where: { email },
      update: { passwordHash, role: 'ADMIN' },
      create: { email, passwordHash, role: 'ADMIN', firstName: 'Admin' },
      select: { id: true, email: true, role: true },
    });

    console.log('Admin user ready:', user);
    return;
  }

  console.log('Usage:');
  console.log('  node prisma/resetAdmin.js list');
  console.log('  node prisma/resetAdmin.js reset <email> <newPassword>');
}

main()
  .catch((err) => {
    console.error('Error:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
