import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.js";
import { AppError } from "../../errors/app-error.js";
import { clearProductCache } from "../../cache/redis.js";
import type { OrderResponseDto } from "./orders.dto.js";
import type { CreateOrderInput } from "./orders.validation.js";

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

export async function createOrder(
  input: CreateOrderInput,
  createdById: string,
): Promise<OrderResponseDto> {
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

    return tx.order.create({
      data: { createdById, total, items: { create: items } },
      include: { items: true },
    });
  });

  return toOrderResponseDto(order);
}

export async function confirmOrder(
  orderId: string,
  actorId: string,
): Promise<OrderResponseDto | undefined> {
  const order = await prisma.$transaction(async (tx) => {
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
    }

    return tx.order.update({
      where: { id: orderId },
      data: { status: "CONFIRMED" },
      include: { items: true },
    });
  });

  if (!order) return undefined;

  await clearProductCache();
  return toOrderResponseDto(order);
}
