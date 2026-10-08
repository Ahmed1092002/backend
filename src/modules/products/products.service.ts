import type { Product as PrismaProduct } from "@prisma/client";
import { prisma } from "../../database/prisma.js";

export type Product = {
  id: string;
  name: string;
  price: number;
};

type CreateProductInput = {
  name: string;
  price: number;
};

type UpdateProductInput = {
  name?: string | undefined;
  price?: number | undefined;
};

function toProduct(product: PrismaProduct): Product {
  return {
    id: product.id,
    name: product.name,
    price: product.price.toNumber(),
  };
}

export async function listProducts(): Promise<Product[]> {
  const products = await prisma.product.findMany({
    orderBy: { createdAt: "asc" },
  });

  return products.map(toProduct);
}

export async function findProductById(id: string): Promise<Product | undefined> {
  const product = await prisma.product.findUnique({ where: { id } });
  return product ? toProduct(product) : undefined;
}

export async function createProduct(
  input: CreateProductInput,
): Promise<Product> {
  const product = await prisma.product.create({ data: input });
  return toProduct(product);
}

export async function updateProductById(
  id: string,
  input: UpdateProductInput,
): Promise<Product | undefined> {
  const existingProduct = await prisma.product.findUnique({ where: { id } });

  if (!existingProduct) {
    return undefined;
  }

  const data = {
    ...(input.name === undefined ? {} : { name: input.name }),
    ...(input.price === undefined ? {} : { price: input.price }),
  };

  const product = await prisma.product.update({
    where: { id },
    data,
  });

  return toProduct(product);
}

export async function deleteProductById(
  id: string,
): Promise<Product | undefined> {
  const existingProduct = await prisma.product.findUnique({ where: { id } });

  if (!existingProduct) {
    return undefined;
  }

  const product = await prisma.product.delete({ where: { id } });
  return toProduct(product);
}
