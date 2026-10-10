import { prisma } from "../../database/prisma.js";
import type { Prisma } from "@prisma/client";

type CreateProductData = {
  name: string;
  price: number;
};

type UpdateProductData = {
  name?: string;
  price?: number;
  imagePath?: string;
};

type ProductPageOptions = {
  offset: number;
  limit: number;
  sortBy: "id" | "name" | "price" | "createdAt";
  sortOrder: "asc" | "desc";
  search?: string | undefined;
  minPrice?: number | undefined;
  maxPrice?: number | undefined;
};

function toWhere({
  search,
  minPrice,
  maxPrice,
}: ProductPageOptions): Prisma.ProductWhereInput {
  const price = {
    ...(minPrice === undefined ? {} : { gte: minPrice }),
    ...(maxPrice === undefined ? {} : { lte: maxPrice }),
  };

  return {
    ...(search === undefined
      ? {}
      : { name: { contains: search, mode: "insensitive" } }),
    ...(Object.keys(price).length === 0 ? {} : { price }),
  };
}

export function findPage(options: ProductPageOptions) {
  const where = toWhere(options);
  const orderBy = {
    id: { id: options.sortOrder },
    name: { name: options.sortOrder },
    price: { price: options.sortOrder },
    createdAt: { createdAt: options.sortOrder },
  }[options.sortBy];

  return prisma.product.findMany({
    orderBy,
    where,
    skip: options.offset,
    take: options.limit,
  });
}

export function count(options: ProductPageOptions) {
  return prisma.product.count({ where: toWhere(options) });
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
