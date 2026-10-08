import { prisma } from "../database/prisma.js";

try {
  await prisma.$queryRaw`SELECT 1`;
  console.log("Database connection successful");
} finally {
  await prisma.$disconnect();
}
