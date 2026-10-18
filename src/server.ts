import { createServer } from "node:http";
import { app } from "./app.js";
import { prisma } from "./database/prisma.js";
import { startOutboxProcessor } from "./jobs/outbox.service.js";
import { registerOrderEventListeners } from "./modules/orders/orders.listeners.js";
import { logger } from "./observability/logger.js";
import {
  closeSocketConnections,
  initializeSocket,
} from "./realtime/socket.js";

const port = Number(process.env.PORT ?? 3000);

const server = createServer(app);
let shuttingDown = false;
let outboxProcessor: ReturnType<typeof startOutboxProcessor> | undefined;

function closeHttpServer() {
  return new Promise<void>((resolve, reject) => {
    // Stop accepting new connections now, but let current HTTP requests finish.
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function shutdown(signal: "SIGTERM" | "SIGINT") {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info("server_shutdown_started", { signal });

  // Containers normally receive SIGTERM. Do not wait forever for a request
  // that is stuck in another system; Docker can then replace this instance.
  const forceExit = setTimeout(() => {
    logger.error("server_shutdown_forced", { timeoutMs: 10_000 });
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  try {
    const httpClosed = closeHttpServer();
    await outboxProcessor?.stop();
    await closeSocketConnections();
    await httpClosed;
    await prisma.$disconnect();
    clearTimeout(forceExit);
    logger.info("server_shutdown_completed", { signal });
    process.exit(0);
  } catch (error) {
    clearTimeout(forceExit);
    logger.error("server_shutdown_failed", { signal, error });
    process.exit(1);
  }
}

async function startServer() {
  // Do not accept socket connections until the Redis adapter is ready. If we
  // later run more API instances, each one is then part of the same realtime
  // message group from its first request.
  await initializeSocket(server);
  registerOrderEventListeners();
  outboxProcessor = startOutboxProcessor();

  server.listen(port, () => {
    logger.info("server_listening", { port });
  });
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

void startServer().catch((error) => {
  logger.error("server_startup_failed", { error });
  process.exit(1);
});
