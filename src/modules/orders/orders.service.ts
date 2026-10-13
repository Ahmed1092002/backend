import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { prisma } from "../../database/prisma.js";
import { AppError } from "../../errors/app-error.js";
import { env } from "../../config/env.js";
import type { OrderResponseDto } from "./orders.dto.js";
import type { CreateOrderInput } from "./orders.validation.js";
import { publishOrderConfirmed } from "./orders.events.js";

function toOrderResponseDto(order: Prisma.OrderGetPayload<{ include: { items: true } }>): OrderResponseDto {
  return {
    id: order.id,
    status: order.status,
    total: order.total.toNumber(),
    createdById: order.createdById,
    createdAt: order.createdAt,
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      unitPrice: item.unitPrice.toNumber(),
      quantity: item.quantity,
    })),
  };
}

function toProductEventPayload(product: {
  id: string;
  name: string;
  price: Prisma.Decimal;
  stock: number;
  imagePath: string | null;
}) {
  return {
    id: product.id,
    name: product.name,
    price: product.price.toNumber(),
    stock: product.stock,
    imageUrl: product.imagePath,
  };
}

export async function createOrder(
  input: CreateOrderInput,
  createdById: string,
  idempotencyKey: string,
): Promise<{ order: OrderResponseDto; replayed: boolean }> {
  const scope = `orders.create:${createdById}`;
  const requestHash = createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");

  try {
    const order = await prisma.$transaction(async (tx) => {
    const products = await tx.product.findMany({
      where: { id: { in: input.items.map((item) => item.productId) } },
    });

    if (products.length !== input.items.length) {
      throw new AppError(404, "One or more products were not found");
    }

    const productById = new Map(products.map((product) => [product.id, product]));
    const items = input.items.map((item) => {
      const product = productById.get(item.productId)!;
      return {
        productId: product.id,
        productName: product.name,
        unitPrice: product.price,
        quantity: item.quantity,
      };
    });
    const total = items.reduce(
      (sum, item) => sum.add(item.unitPrice.mul(item.quantity)),
      new Prisma.Decimal(0),
    );

    const order = await tx.order.create({
      data: { createdById, total, items: { create: items } },
      include: { items: true },
    });

    await tx.idempotencyKey.create({
      data: { scope, key: idempotencyKey, requestHash, orderId: order.id },
    });

    return order;
  });

    return { order: toOrderResponseDto(order), replayed: false };
  } catch (error) {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== "P2002"
    ) {
      throw error;
    }

    const existing = await prisma.idempotencyKey.findUnique({
      where: { scope_key: { scope, key: idempotencyKey } },
      include: { order: { include: { items: true } } },
    });

    if (!existing) throw error;
    if (existing.requestHash !== requestHash) {
      throw new AppError(
        409,
        "Idempotency-Key was already used with a different request",
      );
    }

    return { order: toOrderResponseDto(existing.order), replayed: true };
  }
}

export async function confirmOrder(
  orderId: string,
  actorId: string,
): Promise<OrderResponseDto | undefined> {
  const result = await prisma.$transaction(async (tx) => {
    const orderToConfirm = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!orderToConfirm) return undefined;

    if (orderToConfirm.status !== "DRAFT") {
      throw new AppError(409, "Only a draft order can be confirmed");
    }

    // Always lock products in the same order. This reduces deadlock risk when
    // two requests confirm orders containing the same products.
    const sortedItems = [...orderToConfirm.items].sort((a, b) =>
      a.productId.localeCompare(b.productId),
    );
    const stockChanges: {
      product: ReturnType<typeof toProductEventPayload>;
      crossedLowStock: boolean;
    }[] = [];

    for (const item of sortedItems) {
      const updated = await tx.product.updateMany({
        where: { id: item.productId, stock: { gte: item.quantity } },
        data: { stock: { decrement: item.quantity } },
      });

      if (updated.count === 0) {
        throw new AppError(
          409,
          `Insufficient stock for product: ${item.productName}`,
        );
      }

      await tx.inventoryMovement.create({
        data: {
          productId: item.productId,
          delta: -item.quantity,
          note: `Order ${orderToConfirm.id} confirmed`,
          actorId,
        },
      });

      const product = await tx.product.findUniqueOrThrow({
        where: { id: item.productId },
      });
      stockChanges.push({
        product: toProductEventPayload(product),
        crossedLowStock:
          product.stock <= env.lowStockThreshold &&
          product.stock + item.quantity > env.lowStockThreshold,
      });
    }

    const confirmedOrder = await tx.order.update({
      where: { id: orderId },
      data: { status: "CONFIRMED" },
      include: { items: true },
    });

    return { order: confirmedOrder, stockChanges };
  });

  if (!result) return undefined;

  const order = toOrderResponseDto(result.order);
  await publishOrderConfirmed({ order, stockChanges: result.stockChanges });
  return order;
}

export async function findConfirmedOrderById(
  orderId: string,
): Promise<OrderResponseDto | undefined> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!order) return undefined;
  if (order.status !== "CONFIRMED") {
    throw new AppError(409, "An invoice is available only for confirmed orders");
  }

  return toOrderResponseDto(order);
}
