import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function debugStock() {
  try {
    const packages = await prisma.goldPackage.findMany();
    
    console.log('=== All Gold Packages ===');
    packages.forEach(pkg => {
      console.log(`\nID: ${pkg.id}`);
      console.log(`Name: ${pkg.name}`);
      console.log(`Stock: ${pkg.stock} (type: ${typeof pkg.stock})`);
      console.log(`Price: ${pkg.price}`);
      console.log('---');
    });
    
  } catch (error) {
    console.error('Error querying database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugStock();
