import { prisma } from "../../database/prisma.js";

type CreateProductData = {
  name: string;
  price: number;
};

type UpdateProductData = {
  name?: string;
  price?: number;
};

export function findAll() {
  return prisma.product.findMany({
    orderBy: { createdAt: "asc" },
  });
}

export function findById(id: string) {
  return prisma.product.findUnique({ where: { id } });
}

export function create(data: CreateProductData) {
  return prisma.product.create({ data });
}

export function updateById(id: string, data: UpdateProductData) {
  return prisma.product.update({
    where: { id },
    data,
  });
}

export function deleteById(id: string) {
  return prisma.product.delete({ where: { id } });
}
