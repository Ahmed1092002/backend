import { createServer } from "node:http";
import { app } from "./app.js";
import { startOutboxProcessor } from "./jobs/outbox.service.js";
import { registerOrderEventListeners } from "./modules/orders/orders.listeners.js";
import { logger } from "./observability/logger.js";
import { initializeSocket } from "./realtime/socket.js";

const port = Number(process.env.PORT ?? 3000);

const server = createServer(app);

async function startServer() {
  // Do not accept socket connections until the Redis adapter is ready. If we
  // later run more API instances, each one is then part of the same realtime
  // message group from its first request.
  await initializeSocket(server);
  registerOrderEventListeners();
  startOutboxProcessor();

  server.listen(port, () => {
    logger.info("server_listening", { port });
  });
}

void startServer().catch((error) => {
  logger.error("server_startup_failed", { error });
  process.exit(1);
});
