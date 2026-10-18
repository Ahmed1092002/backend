import type { Server as HttpServer } from "node:http";
import { UserRole } from "@prisma/client";
import { createAdapter } from "@socket.io/redis-adapter";
import { Redis } from "ioredis";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { env } from "../config/env.js";
import type { ProductResponseDto } from "../modules/products/products.dto.js";
import { logger } from "../observability/logger.js";

let io: Server | undefined;

type SocketUser = {
  id: string;
  role: UserRole;
};

export async function initializeSocket(server: HttpServer) {
  // Redis Pub/Sub lets one API instance deliver an emitted Socket.IO event to
  // clients connected to a different API instance. These clients are separate
  // from the Redis client used by caching and the BullMQ clients used by jobs.
  const pubClient = new Redis(env.redisUrl, { lazyConnect: true });
  const subClient = pubClient.duplicate();

  pubClient.on("error", (error) =>
    logger.error("socket_redis_publisher_error", { error }),
  );
  subClient.on("error", (error) =>
    logger.error("socket_redis_subscriber_error", { error }),
  );

  await Promise.all([pubClient.connect(), subClient.connect()]);

  const socketServer = new Server(server, {
    cors: { origin: env.clientOrigin, credentials: true },
  });
  socketServer.adapter(createAdapter(pubClient, subClient));
  io = socketServer;

  // The frontend sends its short-lived access token when opening Socket.IO.
  // Never trust a user id sent by the browser: get it from the verified JWT.
  socketServer.use((socket, next) => {
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

  socketServer.on("connection", (socket) => {
    const user = socket.data.user as SocketUser;
    socket.join(`user:${user.id}`);
    logger.info("socket_connected", { socketId: socket.id, userId: user.id });
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
