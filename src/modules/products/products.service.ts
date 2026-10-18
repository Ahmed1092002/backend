import type { ProductResponseDto } from "./products.dto.js";
import { toProductResponseDto } from "./products.mapper.js";
import * as productsRepository from "./products.repository.js";
import { clearProductCache, getCache, setCache } from "../../cache/redis.js";
import { emitProductEvent } from "../../realtime/socket.js";
import { prisma } from "../../database/prisma.js";
import { AppError } from "../../errors/app-error.js";

type CreateProductInput = {
  name: string;
  price: number;
  stock: number;
};

type UpdateProductInput = {
  name?: string | undefined;
  price?: number | undefined;
  stock?: number | undefined;
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

type ProductPage = {
  products: ProductResponseDto[];
  total: number;
};

type StockMovementPage = {
  movements: {
    id: string;
    delta: number;
    note: string | null;
    actorId: string;
    createdAt: Date;
  }[];
  total: number;
};

type StockMovementCursorPage = {
  movements: {
    id: string;
    delta: number;
    note: string | null;
    actorId: string;
    createdAt: Date;
  }[];
  nextCursor: string | null;
};

type StockMovementCursor = {
  createdAt: string;
  id: string;
};

function decodeStockMovementCursor(cursor: string): StockMovementCursor {
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    ) as unknown;

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("createdAt" in parsed) ||
      !("id" in parsed) ||
      typeof parsed.createdAt !== "string" ||
      typeof parsed.id !== "string" ||
      parsed.id.length === 0 ||
      Number.isNaN(new Date(parsed.createdAt).getTime())
    ) {
      throw new Error("Invalid cursor data");
    }

    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    throw new AppError(400, "cursor is invalid");
  }
}

function encodeStockMovementCursor(movement: {
  createdAt: Date;
  id: string;
}): string {
  return Buffer.from(
    JSON.stringify({ createdAt: movement.createdAt.toISOString(), id: movement.id }),
  ).toString("base64url");
}

export async function listProducts({
  offset,
  limit,
  sortBy,
  sortOrder,
  search,
  minPrice,
  maxPrice,
}: ProductPageOptions): Promise<ProductPage> {
  const cacheKey = `products:${JSON.stringify({ offset, limit, sortBy, sortOrder, search, minPrice, maxPrice })}`;
  const cached = await getCache<ProductPage>(cacheKey);
  if (cached) return cached;
  const [products, total] = await Promise.all([
    productsRepository.findPage({
      offset,
      limit,
      sortBy,
      sortOrder,
      search,
      minPrice,
      maxPrice,
    }),
    productsRepository.count({
      offset,
      limit,
      sortBy,
      sortOrder,
      search,
      minPrice,
      maxPrice,
    }),
  ]);

  const result = {
    products: products.map(toProductResponseDto),
    total,
  };
  await setCache(cacheKey, result, 60);
  return result;
}

export async function findProductById(
  id: string,
): Promise<ProductResponseDto | undefined> {
  const product = await productsRepository.findById(id);
  return product ? toProductResponseDto(product) : undefined;
}

export async function createProduct(
  input: CreateProductInput,
): Promise<ProductResponseDto> {
  const product = await productsRepository.create(input);
  await clearProductCache();
  const result = toProductResponseDto(product);
  emitProductEvent("product:created", result);
  return result;
}

export async function updateProductById(
  id: string,
  input: UpdateProductInput,
): Promise<ProductResponseDto | undefined> {
  const existingProduct = await productsRepository.findById(id);

  if (!existingProduct) {
    return undefined;
  }

  const data = {
    ...(input.name === undefined ? {} : { name: input.name }),
    ...(input.price === undefined ? {} : { price: input.price }),
    ...(input.stock === undefined ? {} : { stock: input.stock }),
  };

  const product = await productsRepository.updateById(id, data);
  await clearProductCache();

  const result = toProductResponseDto(product);
  emitProductEvent("product:updated", result);
  return result;
}

export async function setProductImage(
  id: string,
  imagePath: string,
): Promise<ProductResponseDto | undefined> {
  const existingProduct = await productsRepository.findById(id);

  if (!existingProduct) {
    return undefined;
  }

  const product = await productsRepository.updateById(id, { imagePath });
  await clearProductCache();
  const result = toProductResponseDto(product);
  emitProductEvent("product:updated", result);
  return result;
}

export async function deleteProductById(
  id: string,
): Promise<ProductResponseDto | undefined> {
  const existingProduct = await productsRepository.findById(id);

  if (!existingProduct) {
    return undefined;
  }

  const product = await productsRepository.deleteById(id);
  await clearProductCache();
  const result = toProductResponseDto(product);
  emitProductEvent("product:deleted", result);
  return result;
}

export async function adjustProductStock(
  id: string,
  input: { delta: number; note?: string | undefined },
  actorId: string,
): Promise<ProductResponseDto | undefined> {
  const product = await prisma.$transaction(async (tx) => {
    const updated = await tx.product.updateMany({
      where: {
        id,
        ...(input.delta < 0 ? { stock: { gte: -input.delta } } : {}),
      },
      data: { stock: { increment: input.delta } },
    });

    if (updated.count === 0) {
      const exists = await tx.product.findUnique({ where: { id } });
      if (!exists) return undefined;
      throw new AppError(409, "Stock cannot become negative");
    }

    const updatedProduct = await tx.product.findUniqueOrThrow({ where: { id } });
    await tx.inventoryMovement.create({
      data: {
        productId: id,
        delta: input.delta,
        ...(input.note === undefined ? {} : { note: input.note }),
        actorId,
      },
    });
    return updatedProduct;
  });

  if (!product) return undefined;

  await clearProductCache();
  const result = toProductResponseDto(product);
  emitProductEvent("product:updated", result);
  return result;
}

export async function listProductStockMovements(
  productId: string,
  { offset, limit }: { offset: number; limit: number },
): Promise<StockMovementPage | undefined> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true },
  });

  if (!product) return undefined;

  const [movements, total] = await Promise.all([
    prisma.inventoryMovement.findMany({
      where: { productId },
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
    }),
    prisma.inventoryMovement.count({ where: { productId } }),
  ]);

  return { movements, total };
}

export async function listProductStockMovementsByCursor(
  productId: string,
  { limit, cursor }: { limit: number; cursor?: string | undefined },
): Promise<StockMovementCursorPage | undefined> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true },
  });

  if (!product) return undefined;

  const decodedCursor = cursor ? decodeStockMovementCursor(cursor) : undefined;
  const movements = await prisma.inventoryMovement.findMany({
    where: {
      productId,
      ...(decodedCursor === undefined
        ? {}
        : {
            OR: [
              { createdAt: { lt: new Date(decodedCursor.createdAt) } },
              {
                createdAt: new Date(decodedCursor.createdAt),
                id: { lt: decodedCursor.id },
              },
            ],
          }),
    },
    // id makes the order stable when two movements share the same timestamp.
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });

  const hasMore = movements.length > limit;
  const page = hasMore ? movements.slice(0, limit) : movements;
  const lastMovement = page.at(-1);

  return {
    movements: page,
    nextCursor:
      hasMore && lastMovement ? encodeStockMovementCursor(lastMovement) : null,
  };
}
