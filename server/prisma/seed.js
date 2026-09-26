const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organisation.upsert({
    where: { id: 1 },
    update: {},
    create: { name: 'Acme Corp', status: 'approved' },
  });

  const station = await prisma.policeStation.upsert({
    where: { id: 1 },
    update: {},
    create: { name: 'Manipal Town PS', lat: 13.3467, lng: 74.7869, status: 'approved' },
  });

  console.log('Seeded:', { org, station });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });