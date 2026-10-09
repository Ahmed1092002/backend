import type { RequestHandler } from "express";
import type { UserRole } from "@prisma/client";

export function requireRole(...allowedRoles: UserRole[]): RequestHandler {
  return (req, res, next) => {
    const userRole = res.locals.user?.role as UserRole | undefined;

    if (!userRole || !allowedRoles.includes(userRole)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    next();
  };
}
