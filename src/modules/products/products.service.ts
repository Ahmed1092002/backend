import { prisma } from "../../database/prisma.js";
import type { ProductResponseDto } from "./products.dto.js";
import { toProductResponseDto } from "./products.mapper.js";

type CreateProductInput = {
  name: string;
  price: number;
};

type UpdateProductInput = {
  name?: string | undefined;
  price?: number | undefined;
};

export async function listProducts(): Promise<ProductResponseDto[]> {
  const products = await prisma.product.findMany({
    orderBy: { createdAt: "asc" },
  });

  return products.map(toProductResponseDto);
}

export async function findProductById(
  id: string,
): Promise<ProductResponseDto | undefined> {
  const product = await prisma.product.findUnique({ where: { id } });
  return product ? toProductResponseDto(product) : undefined;
}

export async function createProduct(
  input: CreateProductInput,
): Promise<ProductResponseDto> {
  const product = await prisma.product.create({ data: input });
  return toProductResponseDto(product);
}

export async function updateProductById(
  id: string,
  input: UpdateProductInput,
): Promise<ProductResponseDto | undefined> {
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

  return toProductResponseDto(product);
}

export async function deleteProductById(
  id: string,
): Promise<ProductResponseDto | undefined> {
  const existingProduct = await prisma.product.findUnique({ where: { id } });

  if (!existingProduct) {
    return undefined;
  }

  const product = await prisma.product.delete({ where: { id } });
  return toProductResponseDto(product);
}
