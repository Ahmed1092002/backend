import { prisma } from "../../database/prisma.js";
import type { Prisma } from "@prisma/client";

type CreateProductData = {
  name: string;
  price: number;
  stock: number;
};

type UpdateProductData = {
  name?: string;
  price?: number;
  stock?: number;
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

// Keep database reads aligned with ProductResponseDto. createdAt and updatedAt
// are useful columns, but this endpoint does not expose or use them.
const productResponseSelect = {
  id: true,
  name: true,
  price: true,
  stock: true,
  imagePath: true,
} satisfies Prisma.ProductSelect;

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
    select: productResponseSelect,
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
  return prisma.product.findUnique({
    where: { id },
    select: productResponseSelect,
  });
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
