const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.admin.upsert({
    where: { email: 'admin@voting.com' },
    update: {},
    create: {
      email: 'admin@voting.com',
      username: 'admin',
      password: adminPassword,
      walletAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      role: 'admin',
      isActive: true
    }
  });

  console.log('✅ Admin created:', admin.email);
  console.log('   Password: admin123');

  console.log('\n✅ Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
