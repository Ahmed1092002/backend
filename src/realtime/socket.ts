import type { Server as HttpServer } from "node:http";
import { UserRole } from "@prisma/client";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { env } from "../config/env.js";
import type { ProductResponseDto } from "../modules/products/products.dto.js";

let io: Server | undefined;

type SocketUser = {
  id: string;
  role: UserRole;
};

export function initializeSocket(server: HttpServer) {
  io = new Server(server, {
    cors: { origin: env.clientOrigin, credentials: true },
  });

  // The frontend sends its short-lived access token when opening Socket.IO.
  // Never trust a user id sent by the browser: get it from the verified JWT.
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    if (typeof token !== "string") {
      return next(new Error("Authentication token missing"));
    }

    try {
      const decoded = jwt.verify(token, env.jwtSecret);

      if (
        typeof decoded === "string" ||
        typeof decoded.sub !== "string" ||
        !Object.values(UserRole).includes(decoded.role as UserRole)
      ) {
        return next(new Error("Invalid authentication token"));
      }

      socket.data.user = {
        id: decoded.sub,
        role: decoded.role as UserRole,
      } satisfies SocketUser;
      return next();
    } catch {
      return next(new Error("Invalid or expired authentication token"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.user as SocketUser;
    socket.join(`user:${user.id}`);
    console.log(`Socket connected: ${socket.id} (user: ${user.id})`);
  });
}

export function emitProductEvent(
  event: "product:created" | "product:updated" | "product:deleted",
  product: ProductResponseDto,
) {
  io?.emit(event, product);
}

export function emitUserNotification(
  userId: string,
  notification: { title: string; message: string },
) {
  io?.to(`user:${userId}`).emit("notification:new", notification);
}
