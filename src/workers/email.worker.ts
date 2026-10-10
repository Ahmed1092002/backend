import { Worker } from "bullmq";
import { sendWelcomeEmail } from "../modules/auth/email.service.js";
import { queueConnection } from "../jobs/connection.js";

const worker = new Worker(
  "emails",
  async (job) => {
    if (job.name === "welcome") {
      await sendWelcomeEmail(job.data.name, job.data.email);
    }
  },
  { connection: queueConnection },
);

worker.on("completed", (job) => console.log(`Email job ${job.id} completed`));
worker.on("failed", (job, error) => console.error(`Email job ${job?.id} failed`, error));
