import { Queue } from "bullmq";
import { queueConnection } from "./connection.js";

type WelcomeEmailJob = { name: string; email: string };

export const emailQueue = new Queue<WelcomeEmailJob>("emails", {
  connection: queueConnection,
});

export function queueWelcomeEmail(name: string, email: string) {
  return emailQueue.add("welcome", { name, email }, {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
  });
}
