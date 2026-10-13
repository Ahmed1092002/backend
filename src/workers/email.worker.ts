import { Worker } from "bullmq";
import {
  sendLowStockEmail,
  sendWelcomeEmail,
} from "../modules/auth/email.service.js";
import { queueConnection } from "../jobs/connection.js";
import { logger } from "../observability/logger.js";

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
  logger.info("welcome_email_job_completed", { jobId: job.id }),
);
workerWelcome.on("failed", (job, error) =>
  logger.error("welcome_email_job_failed", { jobId: job?.id, error }),
);
workerLowStock.on("completed", (job) =>
  logger.info("low_stock_email_job_completed", { jobId: job.id }),
);
workerLowStock.on("failed", (job, error) =>
  logger.error("low_stock_email_job_failed", { jobId: job?.id, error }),
);
