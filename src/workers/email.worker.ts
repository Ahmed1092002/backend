import { Worker } from "bullmq";
import {
  sendLowStockEmail,
  sendWelcomeEmail,
} from "../modules/auth/email.service.js";
import { queueConnection } from "../jobs/connection.js";

const workerWelcome = new Worker(
  "welcome-emails",
  async (job) => {
    await sendWelcomeEmail(job.data.name, job.data.email);
  },
  { connection: queueConnection },
);

const workerLowStock = new Worker(
  "low-stock-alerts",
  async (job) => {
    await sendLowStockEmail(job.data.recipients, {
      name: job.data.productName,
      stock: job.data.stock,
    });
  },
  { connection: queueConnection },
);
workerWelcome.on("completed", (job) =>
  console.log(`Welcome email job ${job.id} completed`),
);
workerWelcome.on("failed", (job, error) =>
  console.error(`Welcome email job ${job?.id} failed`, error),
);
workerLowStock.on("completed", (job) =>
  console.log(`Low stock email job ${job.id} completed`),
);
workerLowStock.on("failed", (job, error) =>
  console.error(`Low stock email job ${job?.id} failed`, error),
);
