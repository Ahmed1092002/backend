import { prisma } from "../database/prisma.js";

const products = [
  { id: "1", name: "Laptop", price: 1200 },
  { id: "2", name: "Keyboard", price: 80 },
];

try {
  for (const product of products) {
    await prisma.product.upsert({
      where: { id: product.id },
      update: { name: product.name, price: product.price },
      create: product,
    });
  }

  console.log("Sample products are ready");
} finally {
  await prisma.$disconnect();
}
