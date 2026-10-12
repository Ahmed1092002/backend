import { Queue } from "bullmq";
import { queueConnection } from "./connection.js";

type WelcomeEmailJob = {
  userId: string;
  name: string;
  email: string;
};

type LowStockEmailJob = {
  recipients: string[];
  productName: string;
  stock: number;
};
let welcomeQueue: Queue<WelcomeEmailJob> | undefined;
let lowStockQueue: Queue<LowStockEmailJob> | undefined;
function getWelcomeQueue() {
  welcomeQueue ??= new Queue<WelcomeEmailJob>("welcome-emails", {
    connection: queueConnection,
  });

  return welcomeQueue;
}

function getLowStockQueue() {
  lowStockQueue ??= new Queue<LowStockEmailJob>("low-stock-alerts", {
    connection: queueConnection,
  });

  return lowStockQueue;
}
export function queueWelcomeEmail(userId: string, name: string, email: string) {
  return getWelcomeQueue().add(
    "welcome",
    { userId, name, email },
    {
      jobId: `welcome:${userId}`,
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
    },
  );
}

export function queueLowStockEmail(
  productId: string,
  productName: string,
  stock: number,
  recipients: string[],
) {
  return getLowStockQueue().add(
    "low-stock",
    { recipients, productName, stock },
    {
      // One alert per product and stock value; BullMQ retries the same job.
      jobId: `low-stock:${productId}:${stock}`,
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
    },
  );
}
