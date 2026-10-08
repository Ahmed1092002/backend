import { prisma } from "../../database/prisma.js";

type CreateUserData = {
  email: string;
  name: string;
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

export function findByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

