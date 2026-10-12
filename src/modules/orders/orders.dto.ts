import type { OrderStatus } from "@prisma/client";

export type OrderResponseDto = {
  id: string;
  status: OrderStatus;
  total: number;
  createdById: string;
  createdAt: Date;
  items: {
    id: string;
    productId: string;
    productName: string;
    unitPrice: number;
    quantity: number;
  }[];
};
