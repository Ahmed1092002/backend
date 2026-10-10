import { UserRole } from "@prisma/client";
import { prisma } from "../../database/prisma.js";

type CreateUserData = {
  email: string;
  name: string;
  passwordHash?: string;
};

type UpdateUserData = {
  email?: string;
  name?: string;
};

export function create(data: CreateUserData) {
  return prisma.user.create({ data });
}

export function findAll() {
  return prisma.user.findMany({
    orderBy: { createdAt: "asc" },
  });
}

export function findById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}

export function updateById(id: string, data: UpdateUserData) {
  return prisma.user.update({
    where: { id },
    data,
  });
}

export function updateRoleById(id: string, role: UserRole) {
  return prisma.user.update({
    where: { id },
    data: { role },
  });
}

export function deleteById(id: string) {
  return prisma.user.delete({ where: { id } });
}

export function findByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

