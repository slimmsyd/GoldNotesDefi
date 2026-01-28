import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateStock() {
  try {
    // Update the first item to stock 200
    const updated = await prisma.goldPackage.update({
      where: {
        id: '1767979493249'
      },
      data: {
        stock: 200
      }
    });
    
    console.log('Updated package:', updated);
    console.log('Stock value:', updated.stock, 'Type:', typeof updated.stock);
    
  } catch (error) {
    console.error('Error updating:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateStock();
