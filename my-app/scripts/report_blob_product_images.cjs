#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.goldPackage.findMany({
      where: {
        OR: [
          { image: { startsWith: 'blob:' } },
          { image: { startsWith: 'data:' } },
        ],
      },
      select: {
        id: true,
        name: true,
        image: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!rows.length) {
      console.log('No blob/data image rows found.');
      return;
    }

    console.log(`Found ${rows.length} package(s) with non-portable image URLs:\n`);
    for (const row of rows) {
      console.log(
        JSON.stringify(
          {
            id: row.id,
            name: row.name,
            image: row.image,
            updatedAt: row.updatedAt,
          },
          null,
          2
        )
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Failed to report blob image rows:', error);
  process.exit(1);
});
