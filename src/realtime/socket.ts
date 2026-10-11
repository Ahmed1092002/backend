import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { env } from "../config/env.js";
import type { ProductResponseDto } from "../modules/products/products.dto.js";

let io: Server | undefined;

export function initializeSocket(server: HttpServer) {
  io = new Server(server, {
    cors: { origin: env.clientOrigin, credentials: true },
  });

  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);
  });
}

export function emitProductEvent(
  event: "product:created" | "product:updated" | "product:deleted",
  product: ProductResponseDto,
) {
  io?.emit(event, product);
}
