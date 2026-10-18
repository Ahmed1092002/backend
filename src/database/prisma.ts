import { PrismaClient } from "@prisma/client";

// This module is imported once per Node.js process, so every controller and
// service shares one Prisma client and its connection pool. Creating this
// inside a request handler would create new pools repeatedly and can exhaust
// PostgreSQL connections under traffic.
export const prisma = new PrismaClient();
