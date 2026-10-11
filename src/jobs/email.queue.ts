import { Queue } from "bullmq";
import { queueConnection } from "./connection.js";

type WelcomeEmailJob = { userId: string; name: string; email: string };

export const emailQueue = new Queue<WelcomeEmailJob>("emails", {
  connection: queueConnection,
});

export function queueWelcomeEmail(userId: string, name: string, email: string) {
  return emailQueue.add("welcome", { userId, name, email }, {
    jobId: `welcome:${userId}`,
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
  });
}
